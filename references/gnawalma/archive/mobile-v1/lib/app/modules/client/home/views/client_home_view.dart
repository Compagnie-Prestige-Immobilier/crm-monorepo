import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/location/location_service.dart';
import '../../../../core/network/network_providers.dart';
import '../../../../core/network/session_controller.dart';
import '../../../../routes/app_routes.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../discovery/controllers/marketplace_providers.dart';
import '../../discovery/domain/marketplace_atelier.dart';
import '../../shared/client_categories.dart';
import '../../shared/widgets/client_ui.dart';
import '../../shared/widgets/marketplace_atelier_card.dart';
import 'widgets/promo_carousel.dart';
import '../../../../shared/widgets/inputs/voice_search_button.dart';
import '../../../../shared/widgets/forms/premium_search_bar.dart';

/// The marketplace home.
///
/// This screen used to open with a greeting, a display-size headline, a
/// paragraph of supporting copy, an unDraw illustration and a button — then a
/// grid of six category tiles that all shared one callback and filtered
/// nothing, a sideways-scrolling rail of ateliers, and a three-paragraph
/// "Pourquoi Gnawalma" strip. That is the structure of a landing page, and it
/// answered the question "what is this product?" — which the reader, having
/// already installed and opened it, was not asking.
///
/// The question they are asking is "who can sew this for me, near me, now".
/// So: where you are, a field to search, the categories, and then ateliers —
/// with the photograph, rating, distance and availability the API has been
/// returning all along and the home screen never showed.
class ClientHomeView extends ConsumerWidget {
  const ClientHomeView({super.key});

  /// Le fil d'accueil est une liste de proximité (§2.1) : avec une position il
  /// fixe un rayon, sans position il montre tout le pays plutôt que de mesurer
  /// depuis un point que l'utilisateur n'a pas donné.
  static MarketplaceSearchQuery _nearbyQueryFor(LocationState location) {
    if (!location.hasPosition) {
      return const MarketplaceSearchQuery(limit: 20);
    }
    return MarketplaceSearchQuery(
      latitude: location.latitude,
      longitude: location.longitude,
      limit: 20,
      radiusMeters: 15_000,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = ref.watch(locationControllerProvider);
    final nearbyQuery = _nearbyQueryFor(location);
    final ateliers = ref.watch(marketplaceSearchProvider(nearbyQuery));
    final online = ref.watch(networkAvailabilityProvider).asData?.value ?? true;
    final session = ref.watch(sessionControllerProvider).asData?.value;

    void openSearch({String? term}) {
      final uri = Uri(
        path: AppRoutes.clientSearch,
        queryParameters: term == null ? null : {'q': term},
      );
      context.push(uri.toString());
    }

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(marketplaceSearchProvider(nearbyQuery));
            await ref.read(marketplaceSearchProvider(nearbyQuery).future);
          },
          child: CustomScrollView(
            key: const PageStorageKey('client-home-scroll'),
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: _LocationRow(
                  displayName: session?.displayName,
                  onProfileTap: () => context.go(AppRoutes.clientProfile),
                ),
              ),

              // Pinned so the way out of an unproductive scroll is always one
              // tap away, wherever the reader has got to.
              SliverPersistentHeader(
                pinned: true,
                delegate: _SearchFieldHeader(
                  onTap: () => openSearch(),
                  // §2.5 : le micro est place la ou la recherche commence.
                  // Le laisser uniquement sur l'ecran de resultats obligeait a
                  // passer par un champ texte pour atteindre la dictee — soit
                  // exactement l'obstacle qu'elle doit lever.
                  onSpoken: (term) => openSearch(term: term),
                ),
              ),

              if (!online)
                const SliverToBoxAdapter(child: ClientOfflineBanner()),

              // Emplacement éditorial, alimenté par le back-office. Il
              // disparaît tant que rien n'est publié.
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.only(top: AppSpacing.sm),
                  child: PromoCarousel(),
                ),
              ),

              SliverToBoxAdapter(
                child: _CategoryRail(
                  onSelected: (category) => openSearch(term: category.term),
                ),
              ),

              SliverToBoxAdapter(
                child: ClientSectionHeader(
                  title: location.hasPosition
                      ? 'Près de chez vous'
                      : 'Ateliers vérifiés',
                  // Le classement (§2.4) s'atteint d'ici : un ecran auquel
                  // aucun bouton ne mene n'existe pas pour l'utilisateur.
                  actionLabel: 'Classement',
                  onAction: () => context.push(AppRoutes.clientRanking),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.sm)),

              ateliers.when(
                loading: () => const SliverToBoxAdapter(
                  child: ClientLoadingList(itemCount: 4),
                ),
                error: (_, _) => SliverToBoxAdapter(
                  child: ClientStatePanel(
                    compact: true,
                    icon: Icons.cloud_off_rounded,
                    title: 'Ateliers non chargés',
                    message: 'Vérifiez votre connexion, puis réessayez.',
                    actionLabel: 'Réessayer',
                    onAction: () =>
                        ref.invalidate(marketplaceSearchProvider(nearbyQuery)),
                  ),
                ),
                data: (items) => items.isEmpty
                    ? SliverToBoxAdapter(
                        child: ClientStatePanel(
                          compact: true,
                          icon: Icons.storefront_outlined,
                          title: 'Aucun atelier dans cette zone',
                          message:
                              'Élargissez le rayon pour voir plus de couturiers.',
                          actionLabel: 'Élargir la recherche',
                          onAction: () => openSearch(),
                        ),
                      )
                    : SliverList.separated(
                        itemCount: items.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.md),
                        itemBuilder: (_, index) => Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.gutter,
                          ),
                          child: MarketplaceAtelierCard(atelier: items[index]),
                        ),
                      ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xl)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Where the results are being drawn from, and the way into the profile.
///
/// La ligne annonçait « Ateliers autour de vous » en dur, alors que la
/// recherche partait toujours du centre de Dakar. Elle dit maintenant ce qui
/// est vrai, et porte le seul geste qui peut le changer.
class _LocationRow extends ConsumerWidget {
  const _LocationRow({required this.displayName, required this.onProfileTap});

  final String? displayName;
  final VoidCallback onProfileTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = ref.watch(locationControllerProvider);
    final controller = ref.read(locationControllerProvider.notifier);

    final (label, action) = switch (location.status) {
      LocationStatus.granted when location.hasPosition => (
        'Ateliers autour de vous',
        null,
      ),
      LocationStatus.deniedForever => (
        'Position bloquée pour Gnawalma',
        'Réglages',
      ),
      LocationStatus.serviceDisabled => (
        'Localisation désactivée sur l’appareil',
        'Réglages',
      ),
      LocationStatus.denied => ('Tous les ateliers vérifiés', 'Autoriser'),
      _ => ('Tous les ateliers vérifiés', 'Me localiser'),
    };

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.sm,
        AppSpacing.gutter,
        0,
      ),
      child: Row(
        children: [
          Icon(
            location.hasPosition
                ? Icons.near_me_rounded
                : Icons.near_me_outlined,
            size: 18,
            color: context.accentColor,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.label.copyWith(
                color: context.textPrimaryColor,
              ),
            ),
          ),
          if (action != null)
            TextButton(
              onPressed: location.isResolving
                  ? null
                  : () =>
                        location.status == LocationStatus.deniedForever ||
                            location.status == LocationStatus.serviceDisabled
                        ? controller.openSystemSettings()
                        : controller.requestPosition(),
              child: Text(location.isResolving ? 'Localisation…' : action),
            ),
          _ProfileAvatar(name: displayName, onTap: onProfileTap),
        ],
      ),
    );
  }
}

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({this.name, required this.onTap});

  final String? name;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final initial = (name?.trim().isNotEmpty ?? false)
        ? name!.trim().substring(0, 1).toUpperCase()
        : 'G';
    return Semantics(
      button: true,
      label: 'Profil',
      child: Material(
        color: Colors.transparent,
        shape: CircleBorder(side: BorderSide(color: context.borderColor)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          // Excluded on the contents, not on the Semantics node above: doing it
          // there would take the InkWell's tap action with it.
          child: ExcludeSemantics(
            child: SizedBox(
              width: 40,
              height: 40,
              child: Center(
                child: Text(
                  initial,
                  style: AppTextStyles.label.copyWith(
                    color: context.textPrimaryColor,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The search field.
///
/// A field rather than a tab, and a button rather than a live input: tapping it
/// pushes the results screen, which owns the keyboard, the debounce and the
/// filters. The home screen stays a scroll surface.
class _SearchFieldHeader extends SliverPersistentHeaderDelegate {
  _SearchFieldHeader({required this.onTap, required this.onSpoken});

  final VoidCallback onTap;
  final ValueChanged<String> onSpoken;

  static const double _height = 84.0;

  @override
  double get minExtent => _height;

  @override
  double get maxExtent => _height;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Container(
      height: _height,
      color: context.backgroundColor,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.sm,
        AppSpacing.gutter,
        AppSpacing.sm,
      ),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              button: true,
              label: 'Chercher un atelier',
              // Renders the real search field for its height, spacing and
              // focus styling, but a tap here still just pushes the results
              // screen (IgnorePointer) — the field itself never gets focus,
              // ClientSearchView owns the keyboard and the debounce.
              child: GestureDetector(
                // Opaque: IgnorePointer below blocks its subtree from hit
                // testing, and a GestureDetector defers to its child's hit
                // result by default — without this the tap never reaches
                // onTap at all.
                behavior: HitTestBehavior.opaque,
                onTap: onTap,
                child: ExcludeSemantics(
                  child: IgnorePointer(
                    child: PremiumSearchBar(hintText: 'Chercher un atelier'),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          VoiceSearchButton(onResult: onSpoken),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(_SearchFieldHeader oldDelegate) => false;
}

/// The categories, as a scrolling rail that actually filters.
///
/// This replaces a 3×2 grid of bordered tiles whose six entries all called the
/// same callback with no argument, so every one of them opened the same
/// unfiltered search. A rail also stops the categories from consuming a whole
/// screen height before the reader has seen a single atelier.
class _CategoryRail extends StatelessWidget {
  const _CategoryRail({required this.onSelected});

  final ValueChanged<ClientCategory> onSelected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xs, bottom: AppSpacing.md),
      child: SizedBox(
        // Grows with the system text size rather than clipping the labels at
        // the first step above default.
        height: MediaQuery.textScalerOf(
          context,
        ).clamp(maxScaleFactor: 1.6).scale(44),
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
          itemCount: ClientCategories.all.length,
          separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.xs),
          itemBuilder: (_, index) {
            final category = ClientCategories.all[index];
            return ActionChip(
              avatar: Icon(category.icon, size: 17),
              label: Text(category.label),
              onPressed: () => onSelected(category),
            );
          },
        ),
      ),
    );
  }
}
