import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../data/models/favorite_workshop_model.dart';
import '../../../../routes/app_routes.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/widgets/layouts/polished_page.dart';
import '../../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../discovery/controllers/favorite_workshops_controller.dart';
import '../../discovery/domain/marketplace_atelier.dart';
import '../../shared/widgets/client_ui.dart';
import '../../shared/widgets/marketplace_atelier_card.dart';

class ClientFavoritesView extends ConsumerWidget {
  const ClientFavoritesView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favorites = ref.watch(favoriteWorkshopsProvider);
    final count = favorites.asData?.value.length;
    void openSearch() => context.push(AppRoutes.clientSearch);

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          ClientPageHeader(
            title: 'Ateliers favoris',
            trailing: count == null || count == 0
                ? null
                : AppMetricPill(
                    label: 'enregistré${count == 1 ? '' : 's'}',
                    value: '$count',
                    icon: Icons.favorite_rounded,
                    accentColor: Theme.of(context).colorScheme.primary,
                  ),
          ),
          Expanded(
            child: favorites.when(
              loading: () => const ClientLoadingList(itemCount: 4),
              error: (_, _) => ClientStatePanel(
                icon: Icons.favorite_border_rounded,
                title: 'Favoris indisponibles',
                message:
                    'La liste n’a pas pu être chargée. Vérifiez la connexion puis réessayez.',
                actionLabel: 'Réessayer',
                onAction: () => ref.invalidate(favoriteWorkshopsProvider),
                secondaryActionLabel: 'Explorer les ateliers',
                onSecondaryAction: openSearch,
              ),
              data: (items) => items.isEmpty
                  // The whole tab is this panel, so it gets the drawing: a
                  // headline over blank space is exactly what the screen must
                  // never be.
                  ? ClientStatePanel(
                      motif: AtelierMotif.garment,
                      icon: Icons.favorite_border_rounded,
                      title: 'Rien d’enregistré pour l’instant',
                      message:
                          'Touchez le cœur sur une fiche pour la retrouver ici, même hors ligne.',
                      actionLabel: 'Explorer les ateliers',
                      actionIcon: Icons.search_rounded,
                      onAction: openSearch,
                    )
                  : RefreshIndicator(
                      onRefresh: () async {
                        ref.invalidate(favoriteWorkshopsProvider);
                        await ref.read(favoriteWorkshopsProvider.future);
                      },
                      child: CustomScrollView(
                        key: const PageStorageKey('client-favorites-list'),
                        physics: const AlwaysScrollableScrollPhysics(),
                        slivers: [
                          SliverToBoxAdapter(
                            child: ClientListCaption(
                              label:
                                  '${items.length} atelier${items.length == 1 ? '' : 's'} enregistré${items.length == 1 ? '' : 's'}',
                              trailing: 'Hors ligne',
                            ),
                          ),
                          SliverPadding(
                            padding: const EdgeInsets.fromLTRB(
                              AppSpacing.gutter,
                              0,
                              AppSpacing.gutter,
                              AppSpacing.sectionSpacing,
                            ),
                            sliver: SliverList.separated(
                              itemCount: items.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(height: AppSpacing.sm),
                              itemBuilder: (_, index) => MarketplaceAtelierCard(
                                atelier: _toAtelier(items[index]),
                                horizontal: true,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  MarketplaceAtelier _toAtelier(FavoriteWorkshopModel item) {
    return MarketplaceAtelier(
      id: item.workshopId,
      name: item.workshopName,
      address: item.address,
      phone: item.phone,
      coverUrl: item.imageUrl,
      logoUrl: item.imageUrl,
      specialties: (item.specialty ?? '')
          .split('·')
          .map((value) => value.trim())
          .where((value) => value.isNotEmpty)
          .toList(growable: false),
      portfolio: const [],
      rating: item.rating ?? 0,
      distanceMeters: item.distanceKm == null
          ? null
          : (item.distanceKm! * 1000).round(),
      // Left null on purpose. A cached favourite records who the atelier is,
      // not whether it is still taking work today — asserting "Disponible"
      // and "Nouveau" from a local row told the client things this device had
      // never been told.
      reviewCount: null,
      profileCompleteness: null,
      acceptsNewClients: null,
    );
  }
}
