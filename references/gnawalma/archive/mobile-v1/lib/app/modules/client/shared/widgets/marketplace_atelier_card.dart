import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/config/app_environment.dart';
import '../../../../routes/app_routes.dart';
import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/widgets/interaction/pressable_surface.dart';
import '../../discovery/controllers/favorite_workshops_controller.dart';
import '../../discovery/domain/marketplace_atelier.dart';

class MarketplaceAtelierCard extends ConsumerWidget {
  const MarketplaceAtelierCard({
    super.key,
    required this.atelier,
    this.horizontal = false,
  });

  final MarketplaceAtelier atelier;
  final bool horizontal;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favorites = ref.watch(favoriteWorkshopsProvider);
    final isFavorite =
        favorites.asData?.value.any((item) => item.workshopId == atelier.id) ??
        false;

    return PressableSurface(
      onTap: () =>
          context.push('${AppRoutes.clientAtelierDetail}/${atelier.id}'),
      padding: EdgeInsets.zero,
      // Flat in both orientations. The vertical card was the one elevated
      // object left in the marketplace; a hairline and the gutter group it just
      // as well on a white page.
      showBorder: true,
      accentColor: Theme.of(context).colorScheme.secondary,
      semanticLabel:
          '${atelier.name}, ${atelier.primarySpecialty}, '
          '${atelier.distanceLabel}, note ${atelier.rating.toStringAsFixed(1)} sur 5',
      child: horizontal
          ? _HorizontalContent(
              atelier: atelier,
              isFavorite: isFavorite,
              onFavorite: () => _toggleFavorite(ref),
            )
          : _VerticalContent(
              atelier: atelier,
              isFavorite: isFavorite,
              onFavorite: () => _toggleFavorite(ref),
            ),
    );
  }

  Future<void> _toggleFavorite(WidgetRef ref) {
    return ref.read(favoriteWorkshopsProvider.notifier).toggle(atelier);
  }
}

class _HorizontalContent extends StatelessWidget {
  const _HorizontalContent({
    required this.atelier,
    required this.isFavorite,
    required this.onFavorite,
  });

  final MarketplaceAtelier atelier;
  final bool isFavorite;
  final VoidCallback onFavorite;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _AtelierImage(atelier: atelier, width: 104, height: 104),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: _AtelierSummary(atelier: atelier)),
          _FavoriteButton(selected: isFavorite, onPressed: onFavorite),
        ],
      ),
    );
  }
}

class _VerticalContent extends StatelessWidget {
  const _VerticalContent({
    required this.atelier,
    required this.isFavorite,
    required this.onFavorite,
  });

  final MarketplaceAtelier atelier;
  final bool isFavorite;
  final VoidCallback onFavorite;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      // Full width. This card used to be pinned to 252 because it only ever
      // appeared in a horizontally scrolling rail on the home screen — which
      // meant the app's primary content, the ateliers themselves, was the one
      // thing the reader had to scroll sideways to see. It is a vertical feed
      // now, and the photograph gets the width it needs to be worth showing.
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              _AtelierImage(
                atelier: atelier,
                width: double.infinity,
                height: 176,
                // Follows the card's own corner instead of cutting a smaller
                // radius inside it, which left a visible notch once the card
                // took a hairline border.
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppSpacing.radiusLG - 1),
                ),
              ),
              Positioned(
                top: 8,
                right: 8,
                child: _FavoriteButton(
                  selected: isFavorite,
                  onPressed: onFavorite,
                  onImage: true,
                ),
              ),
              // La pastille « Disponible » posee sur la photo disait la meme
              // chose que la ligne verte juste dessous, en moins precis : elle
              // affichait « Disponible » pour un atelier libre dans neuf jours.
              // La ligne, elle, donne le delai. Une seule des deux subsiste.
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: _AtelierSummary(atelier: atelier),
          ),
        ],
      ),
    );
  }
}

class _AtelierSummary extends StatelessWidget {
  const _AtelierSummary({required this.atelier});

  final MarketplaceAtelier atelier;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurface.withValues(alpha: 0.62);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          atelier.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          atelier.specialties.isEmpty
              ? 'Couture sur mesure'
              : atelier.specialties.take(2).join(' · '),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.bodySmall?.copyWith(color: muted),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xxs,
          children: [
            _Meta(icon: Icons.star_rounded, text: _ratingLabel(atelier)),
            _Meta(icon: Icons.near_me_rounded, text: atelier.distanceLabel),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          atelier.availabilityLabel ?? 'Disponibilité à confirmer',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.labelLarge?.copyWith(
            // Only a confirmed opening earns the status colour; unknown and
            // full both read as neutral rather than inviting.
            color: atelier.acceptsNewClients == true
                ? context.statusForeground(AppColors.success)
                : theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }

  static String _ratingLabel(MarketplaceAtelier atelier) {
    final count = atelier.reviewCount;
    if (count == null) return '—';
    if (count == 0) return 'Nouveau';
    return '${atelier.rating.toStringAsFixed(1)} ($count)';
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Ink, not accent. Two accent glyphs per card times eight cards in a
    // row is the accent budget spent several times over before the reader has
    // scrolled once.
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(width: AppSpacing.xxs),
        Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurface,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _FavoriteButton extends StatelessWidget {
  const _FavoriteButton({
    required this.selected,
    required this.onPressed,
    this.onImage = false,
  });

  final bool selected;
  final VoidCallback onPressed;
  final bool onImage;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // Over a photo the button carries its own near-white chip, so it keeps
    // fixed colours in both themes. On the card it sits on the page surface
    // instead, where a near-black glyph would disappear on the dark page.
    final unselected = onImage
        ? AppColors.textPrimary
        : scheme.onSurfaceVariant;
    return IconButton(
      tooltip: selected ? 'Retirer des favoris' : 'Ajouter aux favoris',
      onPressed: onPressed,
      style: IconButton.styleFrom(
        minimumSize: const Size(44, 44),
        backgroundColor: onImage
            ? Colors.white.withValues(alpha: 0.94)
            : Colors.transparent,
      ),
      icon: Icon(
        // A saved atelier is the one place a card earns the accent: it is the
        // reader's own mark on it. `scheme.secondary` is ink, which made a
        // saved card look identical to an unsaved one at a glance.
        selected ? Icons.favorite_rounded : Icons.favorite_border_rounded,
        color: selected ? scheme.primary : unselected,
      ),
    );
  }
}

class _AtelierImage extends StatelessWidget {
  const _AtelierImage({
    required this.atelier,
    required this.width,
    required this.height,
    this.borderRadius,
  });

  final MarketplaceAtelier atelier;
  final double width;
  final double height;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final url = AppEnvironment.resolveMediaUrl(
      atelier.coverUrl ??
          (atelier.portfolio.isNotEmpty
              ? atelier.portfolio.first.imageUrl
              : null) ??
          atelier.logoUrl,
    );

    return ClipRRect(
      borderRadius: borderRadius ?? BorderRadius.circular(AppSpacing.radiusMD),
      child: SizedBox(
        width: width,
        height: height,
        // Shared element into the detail screen, so the photograph the reader
        // tapped is the one that expands rather than the page cutting to a
        // different picture of the same atelier. Tagged by id: an atelier
        // appears at most once per list, and the two screens are never on
        // screen together.
        child: Hero(
          tag: 'atelier-cover-${atelier.id}',
          child: url.isEmpty
              ? const _ImageFallback()
              : Image.network(
                  url,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => const _ImageFallback(),
                  loadingBuilder: (context, child, progress) {
                    if (progress == null) return child;
                    return const _ImageFallback(showProgress: true);
                  },
                ),
        ),
      ),
    );
  }
}

/// A missing photograph is not a status, so it does not get the accent.
///
/// `AppColors.accentLight` is a light-only terracotta wash: on the dark page it
/// painted a pale pink block where the image should be. Resolved through the
/// scheme it becomes the sunken neutral in both themes.
class _ImageFallback extends StatelessWidget {
  const _ImageFallback({this.showProgress = false});

  final bool showProgress;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(color: scheme.surfaceContainerHighest),
      child: Center(
        child: showProgress
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator.adaptive(),
              )
            : Icon(
                Icons.checkroom_rounded,
                size: 38,
                color: scheme.onSurfaceVariant.withValues(alpha: 0.55),
              ),
      ),
    );
  }
}
