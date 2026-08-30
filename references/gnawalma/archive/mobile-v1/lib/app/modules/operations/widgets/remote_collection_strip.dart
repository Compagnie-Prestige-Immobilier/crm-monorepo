import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../../core/sync/sync_providers.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../controllers/operations_providers.dart';

enum RemoteCollectionKind { clients, orders, inventory }

/// A compact sync line for list pages. Healthy connectivity no longer consumes
/// the vertical space of a full alert banner.
class RemoteCollectionStrip extends ConsumerWidget {
  const RemoteCollectionStrip({super.key, required this.kind});

  final RemoteCollectionKind kind;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(networkAvailabilityProvider).asData?.value ?? true;
    final atelierState = ref.watch(primaryRemoteAtelierProvider);
    final syncSnapshot = ref.watch(primarySyncSnapshotProvider).asData?.value;

    return atelierState.when(
      loading: () => const _CollectionStatus(
        label: 'Connexion au serveur…',
        icon: Icons.cloud_sync_outlined,
        loading: true,
      ),
      error: (_, _) => _CollectionStatus(
        label: online
            ? 'Serveur indisponible · travail local actif'
            : 'Mode hors ligne',
        icon: Icons.cloud_off_outlined,
        tone: _SyncTone.warning,
        onAction: () => ref.invalidate(remoteAteliersProvider),
      ),
      data: (atelier) {
        if (atelier == null) return const SizedBox(height: AppSpacing.xs);
        final collection = switch (kind) {
          RemoteCollectionKind.clients =>
            ref
                .watch(remoteClientsProvider(atelier.id))
                .whenData((page) => page.items.length),
          RemoteCollectionKind.orders =>
            ref
                .watch(remoteOrdersProvider(atelier.id))
                .whenData((page) => page.items.length),
          RemoteCollectionKind.inventory =>
            ref
                .watch(remoteInventoryProvider(atelier.id))
                .whenData((page) => page.items.length),
        };

        return collection.when(
          loading: () => _CollectionStatus(
            label: 'Synchronisation avec ${atelier.name}…',
            icon: Icons.cloud_sync_outlined,
            loading: true,
          ),
          error: (_, _) => _CollectionStatus(
            label: online ? 'Copie serveur non actualisée' : 'Mode hors ligne',
            icon: Icons.cloud_off_outlined,
            tone: _SyncTone.warning,
            onAction: () => _refresh(ref, atelier.id),
          ),
          data: (count) {
            final pending = syncSnapshot?.pendingCount ?? 0;
            final conflicts = syncSnapshot?.conflictCount ?? 0;
            if (conflicts > 0) {
              return _CollectionStatus(
                label:
                    '$conflicts conflit${conflicts == 1 ? '' : 's'} à vérifier',
                meta: _countLabel(count),
                icon: Icons.sync_problem_rounded,
                tone: _SyncTone.warning,
                onAction: () => _refresh(ref, atelier.id),
              );
            }
            if (pending > 0) {
              return _CollectionStatus(
                label:
                    '$pending changement${pending == 1 ? '' : 's'} en attente',
                meta: _countLabel(count),
                icon: Icons.cloud_upload_outlined,
                tone: _SyncTone.info,
                onAction: () => _refresh(ref, atelier.id),
              );
            }
            return _CollectionStatus(
              label: 'Synchronisé',
              meta: '${_countLabel(count)} · ${atelier.name}',
              icon: Icons.cloud_done_outlined,
              tone: _SyncTone.success,
              onAction: () => _refresh(ref, atelier.id),
            );
          },
        );
      },
    );
  }

  String _countLabel(int count) {
    return switch (kind) {
      RemoteCollectionKind.clients => '$count client${count == 1 ? '' : 's'}',
      RemoteCollectionKind.orders => '$count commande${count == 1 ? '' : 's'}',
      RemoteCollectionKind.inventory =>
        '$count article${count == 1 ? '' : 's'}',
    };
  }

  Future<void> _refresh(WidgetRef ref, String atelierId) async {
    try {
      final coordinator = await ref.read(syncCoordinatorProvider.future);
      await coordinator.synchronize(atelierId);
    } finally {
      ref.invalidate(primarySyncSnapshotProvider);
      switch (kind) {
        case RemoteCollectionKind.clients:
          ref.invalidate(remoteClientsProvider(atelierId));
          break;
        case RemoteCollectionKind.orders:
          ref.invalidate(remoteOrdersProvider(atelierId));
          break;
        case RemoteCollectionKind.inventory:
          ref.invalidate(remoteInventoryProvider(atelierId));
          break;
      }
    }
  }
}

enum _SyncTone { neutral, info, success, warning }

class _CollectionStatus extends StatelessWidget {
  const _CollectionStatus({
    required this.label,
    required this.icon,
    this.meta,
    this.tone = _SyncTone.neutral,
    this.onAction,
    this.loading = false,
  });

  final String label;
  final String? meta;
  final IconData icon;
  final _SyncTone tone;
  final VoidCallback? onAction;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final color = switch (tone) {
      _SyncTone.neutral => context.textSecondaryColor,
      _SyncTone.info => AppColors.info,
      _SyncTone.success => AppColors.success,
      _SyncTone.warning => AppColors.warning,
    };
    final isHealthy = tone == _SyncTone.success;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.xs,
        AppSpacing.md,
        AppSpacing.xs,
      ),
      child: Material(
        color: isHealthy ? Colors.transparent : context.surfaceLightColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMD),
        child: InkWell(
          onTap: loading ? null : onAction,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMD),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: isHealthy ? 2 : 12,
              vertical: isHealthy ? 5 : 9,
            ),
            child: Row(
              children: [
                if (loading)
                  SizedBox.square(
                    dimension: 16,
                    child: CircularProgressIndicator.adaptive(
                      valueColor: AlwaysStoppedAnimation(color),
                    ),
                  )
                else
                  Icon(icon, size: isHealthy ? 16 : 18, color: color),
                const SizedBox(width: 8),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption.copyWith(
                    color: color,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (meta != null) ...[
                  const SizedBox(width: 7),
                  Expanded(
                    child: Text(
                      meta!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: context.textSecondaryColor,
                      ),
                    ),
                  ),
                ] else
                  const Spacer(),
                if (onAction != null && !loading)
                  Icon(
                    Icons.refresh_rounded,
                    size: 18,
                    color: context.textSecondaryColor,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
