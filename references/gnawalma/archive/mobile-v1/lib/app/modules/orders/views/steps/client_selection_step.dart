import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/models/client_model.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/forms/premium_search_bar.dart';
import '../../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../../shared/widgets/layouts/polished_page.dart';
import '../../../../shared/widgets/states/empty_state.dart';
import '../../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../controllers/new_order_provider.dart';
import '../widgets/quick_add_client_sheet.dart';

/// Step 1 — who the order is for.
///
/// The step has one job, so it shows one control above the fold: the search
/// field. Creating a client used to sit beside it as a second full-width row of
/// equal weight, which made the step read as a menu of two options rather than
/// as "find someone". It is now the section's own trailing action, and the sole
/// action when nothing matches.
class ClientSelectionStep extends ConsumerWidget {
  const ClientSelectionStep({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(newOrderProvider);
    final notifier = ref.read(newOrderProvider.notifier);
    final clients = state.searchQuery.isEmpty
        ? state.recentClients
        : state.searchResults;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.gutter,
            AppSpacing.md,
            AppSpacing.gutter,
            AppSpacing.xs,
          ),
          child: PremiumSearchBar(
            hintText: 'Nom ou numéro de téléphone',
            onChanged: notifier.onSearchQueryChanged,
            isLoading: state.isSearching,
          ),
        ),
        Expanded(
          child: state.isSearching
              ? const _ClientListSkeleton()
              : clients.isEmpty
              // Bounded height, no outer scroller: the shared empty state
              // is safe here and carries the illustration for the step.
              ? EmptyState(
                  compact: true,
                  motif: AtelierMotif.client,
                  icon: state.searchQuery.isEmpty
                      ? Icons.people_outline_rounded
                      : Icons.person_search_outlined,
                  title: state.searchQuery.isEmpty
                      ? 'Aucun client enregistré'
                      : 'Aucun client trouvé',
                  message: state.searchQuery.isEmpty
                      ? 'Créez le client pour démarrer sa commande et conserver son historique.'
                      : 'Aucun dossier ne correspond à « ${state.searchQuery} ». Vérifiez le nom ou le numéro.',
                  actionLabel: 'Créer un client',
                  onActionPressed: () => _openQuickAdd(context, notifier),
                )
              : _ClientList(
                  clients: clients,
                  isRecent: state.searchQuery.isEmpty,
                  onCreate: () => _openQuickAdd(context, notifier),
                  onSelected: (client) async {
                    await notifier.selectClient(client);
                    notifier.nextStep();
                  },
                ),
        ),
      ],
    );
  }

  void _openQuickAdd(BuildContext context, NewOrder notifier) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: false,
      builder: (_) =>
          QuickAddClientSheet(onClientCreated: notifier.quickCreateClient),
    );
  }
}

class _ClientList extends StatelessWidget {
  const _ClientList({
    required this.clients,
    required this.isRecent,
    required this.onCreate,
    required this.onSelected,
  });

  final List<ClientModel> clients;
  final bool isRecent;
  final VoidCallback onCreate;
  final ValueChanged<ClientModel> onSelected;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      key: const PageStorageKey('new-order-client-list'),
      padding: EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.sm,
        AppSpacing.gutter,
        MediaQuery.paddingOf(context).bottom + AppSpacing.xl,
      ),
      itemCount: clients.length + 1,
      separatorBuilder: (_, index) =>
          SizedBox(height: index == 0 ? AppSpacing.md : AppSpacing.xs),
      itemBuilder: (context, index) {
        if (index == 0) {
          return AppSectionHeader(
            title: isRecent ? 'Clients récents' : 'Résultats',
            subtitle:
                '${clients.length} client${clients.length > 1 ? 's' : ''}',
            icon: isRecent
                ? Icons.history_rounded
                : Icons.manage_search_rounded,
            actionLabel: 'Nouveau',
            onAction: onCreate,
          );
        }
        return _ClientRow(
          client: clients[index - 1],
          onTap: () => onSelected(clients[index - 1]),
        );
      },
    );
  }
}

/// One client, set as a directory entry rather than as a card.
///
/// The monogram is a hairline square in ink — the tinted disc it replaces put a
/// coloured wash on every row, so a list of ten clients read as ten status
/// events instead of as one list.
class _ClientRow extends StatelessWidget {
  const _ClientRow({required this.client, required this.onTap});

  final ClientModel client;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final phone = client.phone?.trim();

    return PressableSurface(
      onTap: onTap,
      showBorder: true,
      semanticLabel:
          'Sélectionner ${client.displayName}${phone?.isNotEmpty == true ? ', $phone' : ''}',
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 14,
      ),
      child: Row(
        children: [
          Hero(
            tag: 'client-avatar-${client.id}',
            child: Container(
              width: 46,
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppSpacing.radiusMD),
                border: Border.all(color: scheme.outlineVariant),
              ),
              child: Text(
                client.initials.isEmpty ? '?' : client.initials,
                maxLines: 1,
                style: AppTextStyles.tag.copyWith(
                  fontSize: 13,
                  color: context.textPrimaryColor,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  client.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.label.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  phone?.isNotEmpty == true
                      ? phone!
                      : 'Téléphone non renseigné',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Icon(
            Icons.chevron_right_rounded,
            size: 21,
            color: context.textSecondaryColor.withValues(alpha: .65),
          ),
        ],
      ),
    );
  }
}

class _ClientListSkeleton extends StatelessWidget {
  const _ClientListSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.md,
        AppSpacing.gutter,
        AppSpacing.md,
      ),
      itemCount: 5,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.xs),
      itemBuilder: (_, _) => Container(
        height: 74,
        decoration: BoxDecoration(
          color: context.surfaceLightColor,
          borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
        ),
      ),
    );
  }
}
