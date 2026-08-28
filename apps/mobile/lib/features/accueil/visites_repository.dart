import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../data/local/database.dart';
import '../../data/repositories/visites_repository.dart';

export '../../core/utils/dakar_time.dart';

/// Les quatre listes du formulaire, lues en LOCAL : elles descendent par le
/// pull comme les banques et les syndicats. Les tenir en ligne rendait le
/// registre lisible hors réseau mais impossible à remplir, ce qui est
/// exactement l'inverse de ce dont l'accueil a besoin.
final StreamProvider<VisiteReferentielsBundleDto> visiteReferentielsProvider =
    StreamProvider<VisiteReferentielsBundleDto>((Ref ref) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
      return (db.select(db.visiteReferentiels)
            ..where((VisiteReferentiels t) => t.isActive.equals(true))
            ..orderBy(<OrderClauseGenerator<VisiteReferentiels>>[
              (VisiteReferentiels t) => OrderingTerm.asc(t.sortOrder),
              (VisiteReferentiels t) => OrderingTerm.asc(t.label),
            ]))
          .watch()
          .map(_bundle);
    });

VisiteReferentielsBundleDto _bundle(List<VisiteReferentiel> rows) {
  List<VisiteReferentielDto> of(String kind) => rows
      .where((VisiteReferentiel r) => r.kind == kind)
      .map(
        (VisiteReferentiel r) => VisiteReferentielDto(
          id: r.id,
          code: r.code,
          label: r.label,
          isActive: r.isActive,
          // Le téléphone ne s'en sert pas : il ne renomme ni ne désactive une
          // entrée, il la propose. Le champ n'est donc pas synchronisé.
          isSystem: false,
          sortOrder: r.sortOrder,
          updatedAt: r.serverUpdatedAt ?? r.localUpdatedAt,
        ),
      )
      .toList(growable: false);

  return VisiteReferentielsBundleDto(
    entreprises: of('entreprises'),
    directions: of('directions'),
    destinataires: of('destinataires'),
    objets: of('objets'),
  );
}

/// La DIRECTION relit le registre au panneau, pas au téléphone : `/sync` lui
/// est fermé (`role-routes.test.ts`), donc lui ouvrir la tuile ne ferait que
/// promettre une saisie qui ne remonterait jamais.
final Set<String> _rolesDuRegistre = <String>{
  Role.ADMIN.value,
  Role.ACCUEIL.value,
};

bool peutTenirLeRegistre(String? role) =>
    role != null && _rolesDuRegistre.contains(role.toUpperCase());

/// Les personnes le plus demandées AUJOURD'HUI : la même requête que l'ordre
/// des listes, sur une fenêtre d'un jour.
final StreamProvider<List<LabelCompte>> destinatairesDuJourProvider =
    StreamProvider<List<LabelCompte>>((Ref ref) {
      return ref
          .watch(visitesRepositoryProvider)
          .watchTopLabels(ref.watch(clockProvider).now(), jours: 1)
          .map((TopLabels top) => top.destinataires);
    });

/// Le champ de recherche du registre garde son texte tant que son élément vit :
/// vider le fournisseur ne suffit pas, il faut remonter le champ. Ce compteur
/// est sa clé.
final NotifierProvider<RegistreSearchReset, int> registreSearchResetProvider =
    NotifierProvider<RegistreSearchReset, int>(RegistreSearchReset.new);

class RegistreSearchReset extends Notifier<int> {
  @override
  int build() => 0;

  void bump() => state = state + 1;
}

/// Vide la recherche du registre ET le champ qui la porte.
void viderRechercheRegistre(WidgetRef ref) {
  if (ref.read(registreSearchProvider).isEmpty) return;
  ref.read(registreSearchProvider.notifier).set('');
  ref.read(registreSearchResetProvider.notifier).bump();
}
