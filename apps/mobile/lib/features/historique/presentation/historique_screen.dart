import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/connectivity.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../data/local/database.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../../../ui/widgets/search_field.dart';
import '../../../ui/widgets/sync_status_icon.dart';
import '../../../ui/async_value_x.dart';

CpiTone _toneFor(SyncStatus status) => switch (status) {
  SyncStatus.synced => CpiTone.success,
  SyncStatus.draft ||
  SyncStatus.pending ||
  SyncStatus.syncing => CpiTone.neutral,
  SyncStatus.conflict || SyncStatus.blocked => CpiTone.warning,
  SyncStatus.failed => CpiTone.danger,
};

/// La base des représentants vient du web : ici on ne crée que des prospects,
/// et toujours en choisissant d'abord chez qui.
void ouvrirAjoutDeProspect(BuildContext context) {
  unawaited(HapticFeedback.selectionClick());
  context.pushOnce(Routes.representants);
}

class HistoriqueScreen extends ConsumerStatefulWidget {
  const HistoriqueScreen({super.key});

  @override
  ConsumerState<HistoriqueScreen> createState() => _HistoriqueScreenState();
}

class _HistoriqueScreenState extends ConsumerState<HistoriqueScreen> {
  late String _fieldText = ref.read(historiqueSearchProvider);

  /// Le champ garde son texte tout seul : il faut le reconstruire pour qu'une
  /// recherche posée d'ailleurs (« Effacer la recherche », « Voir la fiche »)
  /// se voie dans la boîte.
  int _fieldSeed = 0;

  void _search(String value) {
    _fieldText = value;
    ref.read(historiqueSearchProvider.notifier).set(value);
  }

  /// Effacer depuis l'état vide : le champ garde son texte tout seul, il faut
  /// le reconstruire pour que la boîte se vide aussi.
  void _clearSearch() {
    setState(() => _fieldSeed += 1);
    _search('');
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<List<RepresentantSyncViewData>> rows = ref.watch(
      representantListProvider,
    );
    final String search = ref.watch(historiqueSearchProvider);
    if (search != _fieldText) {
      _fieldText = search;
      _fieldSeed += 1;
    }
    final CpiConnectivity network = ref.watch(connectivityProvider);

    return CpiScaffold(
      title: 'Mes fiches',
      banner: network == CpiConnectivity.online
          ? null
          : const Padding(
              padding: EdgeInsets.fromLTRB(
                CpiSpacing.md,
                0,
                CpiSpacing.md,
                CpiSpacing.sm,
              ),
              child: CpiStatusBand(
                text: 'Hors ligne. Vos fiches sont gardées.',
                tone: CpiTone.warning,
              ),
            ),
      footer: CpiActionBar(
        child: CpiButton(
          'Ajouter un prospect',
          icon: PhosphorIconsRegular.plus,
          onPressed: () => ouvrirAjoutDeProspect(context),
        ),
      ),
      body: Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(
              CpiSpacing.md,
              0,
              CpiSpacing.md,
              CpiSpacing.sm,
            ),
            child: CpiSearchField(
              key: ValueKey<int>(_fieldSeed),
              initial: _fieldText,
              onChanged: _search,
            ),
          ),
          Expanded(
            child: rows.whenEchecDAbord(
              loading: () => const Center(child: FCircularProgress()),
              error: (Object e, StackTrace _) => CpiErrorState(
                message:
                    'La liste des représentants n\'a pas pu être lue. '
                    '${messageErreur(e)}',
                onRetry: () => ref.invalidate(representantListProvider),
              ),
              data: (List<RepresentantSyncViewData> list) {
                if (list.isEmpty) {
                  return _EmptyHistorique(
                    searching: search.trim().isNotEmpty,
                    onClearSearch: _clearSearch,
                  );
                }
                return _Liste(list: list);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Liste extends ConsumerWidget {
  const _Liste({required this.list});

  final List<RepresentantSyncViewData> list;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(
            CpiSpacing.md,
            0,
            CpiSpacing.md,
            CpiSpacing.xs,
          ),
          child: Text(
            '${list.length} fiche${list.length > 1 ? 's' : ''}',
            style: theme.textTheme.titleSmall,
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async {
              final SyncCoordinator sync = ref.read(
                syncCoordinatorProvider.notifier,
              );
              await HapticFeedback.selectionClick();
              await sync.run();
            },
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                0,
                CpiSpacing.md,
                CpiSpacing.xxl,
              ),
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: list.length,
              separatorBuilder: (BuildContext context, int index) =>
                  const SizedBox(height: CpiSpacing.xs),
              itemBuilder: (BuildContext context, int index) => CpiListEntrance(
                index: index,
                child: _RepresentantTile(
                  key: ValueKey<String>(list[index].id),
                  data: list[index],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Une ligne, un tap, la fiche. Modifier, qualifier et supprimer vivent dans la
/// fiche ouverte : ici rien ne se cache derrière un panneau ni un balayage.
class _RepresentantTile extends StatelessWidget {
  const _RepresentantTile({super.key, required this.data});

  final RepresentantSyncViewData data;

  @override
  Widget build(BuildContext context) {
    final SyncStatus status = SyncStatus.parse(data.syncStatus ?? 'draft');
    return CpiCard.rows(<CpiRow>[
      CpiRow(
        title: data.fullName,
        subtitle: Phone.format(data.phoneE164),
        leading: SyncStatusIcon(
          status: status,
          size: CpiIconSize.xl,
          labelled: false,
        ),
        trailing: CpiTag(status.label, tone: _toneFor(status)),
        onTap: () => context.pushOnce(Routes.representantDetailFor(data.id)),
      ),
    ]);
  }
}

class _EmptyHistorique extends StatelessWidget {
  const _EmptyHistorique({
    required this.searching,
    required this.onClearSearch,
  });

  final bool searching;
  final VoidCallback onClearSearch;

  @override
  Widget build(BuildContext context) {
    if (searching) {
      return CpiEmptyState(
        icon: PhosphorIconsDuotone.magnifyingGlass,
        title: 'Aucun résultat.',
        message: 'Vérifiez le nom ou le numéro.',
        action: CpiButton(
          'Effacer la recherche',
          expand: false,
          onPressed: onClearSearch,
        ),
      );
    }
    return CpiEmptyState(
      icon: PhosphorIconsDuotone.clockCounterClockwise,
      title: 'Aucune fiche',
      message: 'Ajoutez un prospect chez un représentant pour commencer.',
      action: CpiButton(
        'Ajouter un prospect',
        icon: PhosphorIconsRegular.plus,
        expand: false,
        onPressed: () => ouvrirAjoutDeProspect(context),
      ),
    );
  }
}
