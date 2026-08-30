import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/client_model.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/cards/client_card.dart';
import '../../../shared/widgets/forms/premium_search_bar.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/navigation/alphabet_index.dart';
import '../../../shared/widgets/states/empty_state.dart';
import '../../../shared/widgets/states/skeleton.dart';
import '../../../shared/widgets/states/error_state.dart';
import '../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../operations/widgets/remote_collection_strip.dart';
import '../controllers/clients_provider.dart';
import '../controllers/clients_state.dart';
import '../../../shared/theme/app_motion.dart';

class ClientsView extends ConsumerStatefulWidget {
  const ClientsView({super.key});

  @override
  ConsumerState<ClientsView> createState() => _ClientsViewState();
}

class _ClientsViewState extends ConsumerState<ClientsView> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(clientsProvider);
    final notifier = ref.read(clientsProvider.notifier);
    final grouped = notifier.groupedClients;
    final visibleCount = grouped.values.fold<int>(
      0,
      (sum, items) => sum + items.length,
    );

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            AppPageHeader(
              title: 'Clients',
              subtitle: state.searchQuery.isEmpty
                  ? '$visibleCount client${visibleCount == 1 ? '' : 's'} enregistré${visibleCount == 1 ? '' : 's'}'
                  : '$visibleCount résultat${visibleCount == 1 ? '' : 's'}',
              accentColor: Theme.of(context).colorScheme.primary,
              trailing: visibleCount == 0
                  ? null
                  : IconButton.filled(
                      tooltip: 'Ajouter un client',
                      onPressed: notifier.navigateToAddClient,
                      icon: const Icon(Icons.person_add_alt_1_rounded),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.gutter,
              ),
              child: PremiumSearchBar(
                hintText: 'Nom ou numéro de téléphone',
                onChanged: notifier.setSearchQuery,
                onClear: () => notifier.setSearchQuery(''),
              ),
            ),
            const RemoteCollectionStrip(kind: RemoteCollectionKind.clients),
            Expanded(
              child: Builder(
                builder: (context) {
                  if (state.isLoading) {
                    return const _ClientsSkeleton();
                  }
                  if (state.hasError && state.clients.isEmpty) {
                    return ErrorState(
                      message: 'Impossible de charger votre carnet de clients.',
                      onRetry: notifier.refresh,
                    );
                  }
                  if (grouped.isEmpty) {
                    // Kept scrollable so pull-to-refresh works from the empty
                    // state too.
                    return RefreshIndicator(
                      onRefresh: notifier.refresh,
                      child: CustomScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        slivers: [
                          SliverFillRemaining(
                            hasScrollBody: false,
                            child: _buildEmptyState(state, notifier),
                          ),
                        ],
                      ),
                    );
                  }

                  final showIndex =
                      state.searchQuery.isEmpty && grouped.length > 3;
                  final bottomInset = MediaQuery.paddingOf(context).bottom;
                  return Stack(
                    children: [
                      RefreshIndicator(
                        onRefresh: notifier.refresh,
                        child: ListView.builder(
                          key: const PageStorageKey('clients-list-scroll'),
                          controller: _scrollController,
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: EdgeInsets.fromLTRB(
                            AppSpacing.gutter,
                            AppSpacing.xs,
                            // Reserve room for the alphabet rail only while it
                            // is actually shown.
                            showIndex ? 40 : AppSpacing.gutter,
                            bottomInset + AppSpacing.md,
                          ),
                          itemCount: _itemCount(grouped),
                          itemBuilder: (context, index) =>
                              _buildItem(context, notifier, grouped, index),
                        ),
                      ),
                      if (showIndex)
                        Positioned(
                          right: 2,
                          top: 12,
                          bottom: bottomInset + AppSpacing.xs,
                          child: AlphabetIndex(
                            letters: grouped.keys.toList(),
                            currentLetter: null,
                            onLetterSelected: (letter) =>
                                _scrollToLetter(letter, grouped),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(ClientsState state, Clients notifier) {
    return EmptyState(
      motif: AtelierMotif.client,
      compact: true,
      icon: state.searchQuery.isEmpty
          ? Icons.people_outline_rounded
          : Icons.person_search_rounded,
      title: state.searchQuery.isEmpty
          ? 'Aucun client pour le moment'
          : 'Aucun client correspondant',
      message: state.searchQuery.isEmpty
          ? 'Ajoutez une personne pour conserver ses mesures et démarrer une commande.'
          : 'Essayez un autre nom ou numéro.',
      actionLabel: state.searchQuery.isEmpty ? 'Ajouter un client' : null,
      onActionPressed: state.searchQuery.isEmpty
          ? notifier.navigateToAddClient
          : null,
      secondaryActionLabel: state.searchQuery.isNotEmpty
          ? 'Effacer la recherche'
          : null,
      onSecondaryActionPressed: state.searchQuery.isNotEmpty
          ? () => notifier.setSearchQuery('')
          : null,
    );
  }

  int _itemCount(Map<String, List<ClientModel>> grouped) => grouped.entries
      .fold<int>(0, (count, entry) => count + 1 + entry.value.length);

  Widget _buildItem(
    BuildContext context,
    Clients notifier,
    Map<String, List<ClientModel>> grouped,
    int index,
  ) {
    var cursor = 0;
    for (final entry in grouped.entries) {
      if (cursor == index) {
        return Padding(
          padding: const EdgeInsets.only(top: AppSpacing.md, bottom: 7),
          child: Text(
            entry.key,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: Theme.of(context).colorScheme.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
        );
      }
      cursor++;
      if (index < cursor + entry.value.length) {
        final client = entry.value[index - cursor];
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.xs),
          child: ClientCard(
            client: client,
            onTap: () => notifier.navigateToClientDetails(client),
            margin: EdgeInsets.zero,
          ),
        );
      }
      cursor += entry.value.length;
    }
    return const SizedBox.shrink();
  }

  void _scrollToLetter(String letter, Map<String, List<ClientModel>> grouped) {
    if (!_scrollController.hasClients) return;
    var targetItem = 0;
    for (final entry in grouped.entries) {
      if (entry.key == letter) break;
      targetItem += 1 + entry.value.length;
    }
    final max = _scrollController.position.maxScrollExtent;
    _scrollController.animateTo(
      (targetItem * 84.0).clamp(0.0, max).toDouble(),
      duration: AppMotion.quick,
      curve: Curves.easeOutCubic,
    );
  }
}

/// Mirrors the grouped list: a letter header, then card rows, at the same
/// gutters the loaded list uses.
class _ClientsSkeleton extends StatelessWidget {
  const _ClientsSkeleton();

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          AppSpacing.xs,
          AppSpacing.gutter,
          MediaQuery.paddingOf(context).bottom + AppSpacing.md,
        ),
        children: [
          for (var group = 0; group < 3; group++) ...[
            const Padding(
              padding: EdgeInsets.only(top: AppSpacing.md, bottom: 7),
              child: SkeletonBox(width: 18, height: 14),
            ),
            for (var row = 0; row < 3; row++) ...[
              if (row > 0) const SizedBox(height: AppSpacing.xs),
              const SkeletonBox(height: 76, radius: AppSpacing.radiusCard),
            ],
          ],
        ],
      ),
    );
  }
}
