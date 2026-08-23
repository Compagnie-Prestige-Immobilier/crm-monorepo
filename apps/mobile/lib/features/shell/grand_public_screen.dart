import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/sync_coordinator.dart';
import '../../core/router/route_paths.dart';
import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../core/utils/phone.dart';
import '../../data/local/database.dart';
import '../../data/repositories/write_repository.dart';
import '../../ui/async_value_x.dart';
import '../../ui/widgets/empty_state.dart';
import '../../ui/widgets/error_state.dart';
import '../../ui/widgets/offline_indicator.dart';
import '../../ui/widgets/search_field.dart';
import '../../ui/widgets/sync_badge.dart';
import '../../ui/widgets/sync_status_icon.dart';
import '../campagnes/campagnes.dart';

class GrandPublicScreen extends ConsumerWidget {
  const GrandPublicScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<ProspectSyncViewData>> prospects = ref.watch(
      grandPublicProspectListProvider,
    );
    final AsyncValue<int> count = ref.watch(grandPublicProspectCountProvider);
    final AsyncValue<List<CampaignsWithOpenWorkResult>> campaigns = ref.watch(
      grandPublicCampagnesProvider,
    );
    final String search = ref.watch(historiqueSearchProvider);
    final List<CampaignsWithOpenWorkResult> campaignRows =
        campaigns.value ?? const <CampaignsWithOpenWorkResult>[];
    final int openCalls = campaignRows.fold<int>(
      0,
      (int total, CampaignsWithOpenWorkResult campaign) =>
          total + campaign.ouvertes,
    );

    void openCallsQueue() {
      if (campaignRows.length == 1) {
        context
            .push(CampagnesRoutes.grandPublicFileFor(campaignRows.single.id))
            .ignore();
        return;
      }
      context.push(CampagnesRoutes.grandPublicListe).ignore();
    }

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(PhosphorIconsRegular.squaresFour),
          tooltip: 'Projets',
          onPressed: () => context.go(Routes.home),
        ),
        title: const Text('Projet Grand Public'),
        actions: <Widget>[
          IconButton(
            icon: const Icon(PhosphorIconsRegular.userPlus),
            tooltip: 'Nouveau prospect',
            onPressed: () => context.push(Routes.grandPublicNew),
          ),
          const OfflineIndicator(),
          const SyncBadge(),
          const SizedBox(width: CpiSpacing.xs),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                CpiSpacing.md,
                CpiSpacing.md,
                0,
              ),
              child: _CallConsoleCard(
                openCalls: openCalls,
                loading: campaigns.isLoading,
                onTap: openCallsQueue,
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                CpiSpacing.md,
                CpiSpacing.md,
                CpiSpacing.sm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text(
                    count.when(
                      data: (int value) =>
                          '$value prospect${value > 1 ? 's' : ''}',
                      loading: () => 'Prospects',
                      error: (Object error, StackTrace stackTrace) =>
                          'Prospects',
                    ),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: CpiSpacing.sm),
                  CpiSearchField(
                    initial: ref.read(historiqueSearchProvider),
                    onChanged: ref.read(historiqueSearchProvider.notifier).set,
                  ),
                ],
              ),
            ),
            Expanded(
              child: prospects.whenEchecDAbord(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (Object error, StackTrace _) => CpiErrorState(
                  message:
                      'La liste des prospects n\'a pas pu être lue. '
                      '${messageErreur(error)}',
                  onRetry: () =>
                      ref.invalidate(grandPublicProspectListProvider),
                ),
                data: (List<ProspectSyncViewData> rows) {
                  if (rows.isEmpty) {
                    return _Empty(searching: search.trim().isNotEmpty);
                  }
                  return RefreshIndicator(
                    onRefresh: () async {
                      await HapticFeedback.selectionClick();
                      await ref.read(syncCoordinatorProvider.notifier).run();
                    },
                    child: ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.only(bottom: CpiSpacing.xxl),
                      itemCount: rows.length,
                      itemBuilder: (BuildContext context, int index) =>
                          _ProspectTile(
                            key: ValueKey<String>(rows[index].id),
                            prospect: rows[index],
                          ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CallConsoleCard extends StatelessWidget {
  const _CallConsoleCard({
    required this.openCalls,
    required this.loading,
    required this.onTap,
  });

  final int openCalls;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(CpiSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer,
        borderRadius: CpiRadius.brLg,
      ),
      child: Row(
        children: <Widget>[
          Icon(
            PhosphorIconsDuotone.headset,
            size: CpiIconSize.xxxl,
            color: theme.colorScheme.onPrimaryContainer,
          ),
          const SizedBox(width: CpiSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('Console d’appel', style: theme.textTheme.titleMedium),
                const SizedBox(height: CpiSpacing.xxs),
                Text(
                  loading
                      ? 'Chargement de la file…'
                      : openCalls == 0
                      ? 'Aucune fiche en attente'
                      : '$openCalls fiche${openCalls > 1 ? 's' : ''} à traiter',
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(width: CpiSpacing.sm),
          IconButton.filled(
            onPressed: onTap,
            tooltip: openCalls == 0 ? 'Voir les campagnes' : 'Ouvrir la file',
            icon: const Icon(PhosphorIconsRegular.arrowRight),
          ),
        ],
      ),
    );
  }
}

class _ProspectTile extends ConsumerWidget {
  const _ProspectTile({super.key, required this.prospect});

  final ProspectSyncViewData prospect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String name = '${prospect.prenom} ${prospect.nom}'.trim();
    return Dismissible(
      key: ValueKey<String>('gp-${prospect.id}'),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        color: context.cpi.syncFailed,
        padding: const EdgeInsets.only(right: CpiSpacing.lg),
        child: const Icon(PhosphorIconsRegular.trash, color: Colors.white),
      ),
      confirmDismiss: (DismissDirection _) async {
        // Même piège qu'à l'Historique : la ligne se démonte avec la
        // confirmation, et `ref` lu après l'`await` n'envoie plus rien.
        final SyncCoordinator sync = ref.read(syncCoordinatorProvider.notifier);
        final WriteRepository writes = ref.read(writeRepositoryProvider);
        final bool? confirmed = await showDialog<bool>(
          context: context,
          builder: (BuildContext context) => AlertDialog(
            title: const Text('Supprimer ce prospect ?'),
            content: Text('$name sera supprimé.'),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Annuler'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Supprimer'),
              ),
            ],
          ),
        );
        if (confirmed != true) return false;
        try {
          await writes.deleteProspect(prospect.id);
          sync.nudge();
          return true;
        } on Object catch (error) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Suppression impossible. $error')),
            );
          }
          return false;
        }
      },
      child: ListTile(
        leading: SyncStatusIcon(
          status: SyncStatus.parse(prospect.syncStatus ?? 'draft'),
          size: CpiIconSize.lg,
        ),
        title: Text(name),
        subtitle: Text(Phone.format(prospect.phoneE164)),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.searching});

  final bool searching;

  @override
  Widget build(BuildContext context) => CpiEmptyState(
    icon: searching
        ? PhosphorIconsDuotone.magnifyingGlass
        : PhosphorIconsDuotone.usersThree,
    title: searching ? 'Aucun résultat' : 'Aucun prospect à traiter',
    message: searching
        ? 'Vérifiez le nom ou le numéro, ou effacez la recherche.'
        : 'Synchronisez pour recevoir les prospects à traiter.',
  );
}
