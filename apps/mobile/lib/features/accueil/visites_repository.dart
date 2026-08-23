import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../data/local/database.dart';

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

/// Le registre du jour, lu en local : il tient sans réseau, comme le reste de
/// l'application. Une inscription hors ligne y apparaît immédiatement, sa
/// référence complétée dès que le pull suivant la redescend.
final StreamProvider<List<Visite>> registreDuJourProvider =
    StreamProvider<List<Visite>>((Ref ref) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
      final String jour = jourDakar(ref.watch(clockProvider).now());
      return db.registreDuJour(jour: jour).watch();
    });

/// Dakar est à UTC toute l'année : l'horloge du serveur et la sienne coïncident.
String jourDakar(DateTime at) {
  final DateTime utc = at.toUtc();
  return '${utc.year.toString().padLeft(4, '0')}-'
      '${utc.month.toString().padLeft(2, '0')}-'
      '${utc.day.toString().padLeft(2, '0')}';
}

String heureDakar(DateTime at) {
  final DateTime utc = at.toUtc();
  return '${utc.hour.toString().padLeft(2, '0')}:'
      '${utc.minute.toString().padLeft(2, '0')}';
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
