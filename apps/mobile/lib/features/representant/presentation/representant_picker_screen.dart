import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../data/local/database.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../../ui/widgets/offline_indicator.dart';
import '../../../ui/widgets/sync_status_icon.dart';

/// Choisir un représentant existant.
///
/// ═══ POURQUOI CET ÉCRAN EXISTE ═══
///
/// Le routeur n'enregistrait que `/representants/nouveau` : depuis l'accueil, un
/// commercial ne pouvait que **créer**. Ajouter des prospects à un représentant
/// déjà en base supposait de passer par l'Historique et d'y trouver la bonne
/// ligne : un détour que personne ne fait, si bien que la seule issue visible
/// était de ressaisir la fiche. La détection de doublon par téléphone
/// (`representant_form_screen.dart`) rattrapait ensuite le geste, mais après
/// coup, et seulement si le numéro était tapé à l'identique.
///
/// Le parcours normal devient donc « choisir ». La création reste à un geste,
/// en bas de cet écran, pour ce qu'elle est réellement : le cas d'une fiche qui
/// naît en tournée.
///
/// ## Pourquoi ce n'est pas l'Historique
///
/// L'Historique est une vue d'audit : lignes dépliables vers leurs prospects,
/// suppression par balayage, état de synchronisation cliquable. Ici, une seule
/// question est posée et une seule réponse est attendue : quel représentant ?
/// Un tap mène droit à la saisie de prospects, sans rien d'autre à décider.
///
/// **Tout vient de la base locale.** Aucune requête réseau : la sélection doit
/// être instantanée et fonctionner dans un village sans couverture, c'est-à-dire
/// là où l'application sert.
class RepresentantPickerScreen extends ConsumerStatefulWidget {
  const RepresentantPickerScreen({super.key});

  @override
  ConsumerState<RepresentantPickerScreen> createState() =>
      _RepresentantPickerScreenState();
}

class _RepresentantPickerScreenState extends ConsumerState<RepresentantPickerScreen> {
  /// Le champ est PILOTÉ par le provider, il ne se contente pas de l'alimenter.
  ///
  /// Sans contrôleur, le terme de recherche vivait dans un `Notifier` de portée
  /// racine pendant que le `TextField` repartait vide à chaque montage : revenir
  /// sur cet écran affichait une boîte de recherche vide au-dessus d'une liste
  /// toujours filtrée, et souvent le message « Aucun résultat » sans que rien
  /// n'explique pourquoi.
  late final TextEditingController _search = TextEditingController(
    text: ref.read(representantPickerSearchProvider),
  );

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _setSearch(String value) {
    ref.read(representantPickerSearchProvider.notifier).set(value);
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<List<RepresentantSyncViewData>> rows = ref.watch(
      representantPickerListProvider,
    );
    final String search = ref.watch(representantPickerSearchProvider);
    // Une seule lecture de la liste des départements, transformée en index :
    // résoudre le libellé ligne par ligne créerait une requête par
    // représentant affiché.
    final Map<String, String> departements = <String, String>{
      for (final Departement d in ref.watch(departementsProvider).value ?? const [])
        d.id: d.name,
    };

    return CpiPopScope(
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Choisir un représentant'),
          leading: const CpiBackButton(),
          actions: const <Widget>[OfflineIndicator(), SizedBox(width: CpiSpacing.xs)],
        ),
        body: SafeArea(
          child: Column(
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  CpiSpacing.md,
                  CpiSpacing.sm,
                  CpiSpacing.md,
                  CpiSpacing.sm,
                ),
                child: TextField(
                  controller: _search,
                  autofocus: false,
                  onChanged: _setSearch,
                  decoration: InputDecoration(
                    hintText: 'Nom ou numéro',
                    prefixIcon: const Icon(
                      PhosphorIconsRegular.magnifyingGlass,
                      size: 20,
                    ),
                    suffixIcon: search.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Effacer la recherche',
                            icon: const Icon(PhosphorIconsRegular.xCircle, size: 20),
                            onPressed: () {
                              _search.clear();
                              _setSearch('');
                            },
                          ),
                  ),
                ),
              ),
              Expanded(
                child: rows.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (Object e, StackTrace _) =>
                      Center(child: Text('Lecture impossible : $e')),
                  data: (List<RepresentantSyncViewData> list) {
                    if (list.isEmpty) {
                      return _Empty(searching: search.trim().isNotEmpty);
                    }
                    return ListView.separated(
                      padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
                      itemCount: list.length,
                      separatorBuilder: (BuildContext context, int index) =>
                          const Divider(
                            height: 1,
                            indent: CpiSpacing.md,
                            endIndent: CpiSpacing.md,
                          ),
                      itemBuilder: (BuildContext context, int index) => CpiListEntrance(
                        index: index,
                        child: _RepresentantRow(
                          data: list[index],
                          departement: departements[list[index].departementId],
                        ),
                      ),
                    );
                  },
                ),
              ),
              _CreateBar(query: search),
            ],
          ),
        ),
      ),
    );
  }
}

class _RepresentantRow extends StatelessWidget {
  const _RepresentantRow({required this.data, this.departement});

  final RepresentantSyncViewData data;
  final String? departement;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final SyncStatus status = SyncStatus.parse(data.syncStatus ?? 'draft');
    final String subtitle = departement == null
        ? Phone.format(data.phoneE164)
        : '${Phone.format(data.phoneE164)} · $departement';

    return Semantics(
      button: true,
      label: '${data.fullName}, $subtitle. Ajouter des prospects.',
      child: ExcludeSemantics(
        child: InkWell(
          // `push` et non `pushReplacement` : après avoir saisi les prospects
          // d'un représentant, on revient souvent en choisir un autre dans la
          // même concession. Remplacer l'écran obligerait à refaire le chemin
          // depuis l'accueil à chaque fois.
          onTap: () {
            HapticFeedback.selectionClick();
            context.pushOnce(Routes.newProspectFor(data.id));
          },
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: kCpiMinTouchTarget + 12),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: CpiSpacing.md,
                vertical: CpiSpacing.sm,
              ),
              child: Row(
                children: <Widget>[
                  SyncStatusIcon(status: status, size: 20),
                  const SizedBox(width: CpiSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text(data.fullName, style: theme.textTheme.titleSmall),
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    PhosphorIconsRegular.userPlus,
                    size: 20,
                    color: context.cpi.accentText,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Création, en zone de pouce.
///
/// Elle reste pleine largeur et parfaitement visible : « choisir » est le cas
/// courant, « créer » n'est pas pour autant à cacher : un représentant
/// rencontré en tournée doit s'enregistrer sans chercher où.
class _CreateBar extends StatelessWidget {
  const _CreateBar({required this.query});

  /// La recherche en cours. Elle part avec l'utilisateur : chercher « Ousmane »,
  /// ne pas le trouver, puis retaper « Ousmane » dans l'écran suivant est un
  /// geste de plus au moment précis où l'on vient d'en faire un pour rien.
  final String query;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.xs,
        CpiSpacing.md,
        CpiSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(top: BorderSide(color: context.cpi.borderSubtle)),
      ),
      child: OutlinedButton.icon(
        onPressed: () {
          HapticFeedback.selectionClick();
          context.pushOnce(Routes.newRepresentantPrefilled(query));
        },
        icon: const Icon(PhosphorIconsRegular.plus, size: 20),
        label: const Text('Nouveau représentant'),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.searching});

  /// Une recherche sans résultat et une base vide n'appellent pas le même
  /// message : dans le premier cas il y a quelque chose à corriger, dans le
  /// second il n'y a rien à trouver.
  final bool searching;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(CpiSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              searching
                  ? PhosphorIconsDuotone.magnifyingGlass
                  : PhosphorIconsDuotone.usersThree,
              size: 56,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: CpiSpacing.md),
            Text(
              searching ? 'Aucun résultat' : 'Aucun représentant',
              style: theme.textTheme.titleSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: CpiSpacing.xs),
            Text(
              searching
                  ? 'Vérifiez le nom ou le numéro, ou créez la fiche.'
                  : 'Créez une première fiche pour commencer à saisir des prospects.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
