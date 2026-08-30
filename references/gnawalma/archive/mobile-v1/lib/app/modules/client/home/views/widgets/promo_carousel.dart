import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/config/app_environment.dart';
import '../../../../../routes/app_routes.dart';
import '../../../../../shared/theme/app_colors_extensions.dart';
import '../../../../../shared/theme/app_spacing.dart';
import '../../../../../shared/theme/app_text_styles.dart';
import '../../../discovery/controllers/marketplace_providers.dart';
import '../../../discovery/domain/marketplace_atelier.dart';

/// Les mises en avant de l'accueil.
///
/// Rien ne s'affiche tant que le back-office n'a rien publié : l'emplacement
/// disparaît au lieu de laisser un cadre vide, et une erreur réseau ne doit pas
/// abîmer une page dont ce n'est pas le contenu principal.
class PromoCarousel extends ConsumerStatefulWidget {
  const PromoCarousel({super.key});

  @override
  ConsumerState<PromoCarousel> createState() => _PromoCarouselState();
}

class _PromoCarouselState extends ConsumerState<PromoCarousel> {
  final _controller = PageController(viewportFraction: 0.92);
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final promotions = ref.watch(marketplacePromotionsProvider).value;
    if (promotions == null || promotions.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      children: [
        SizedBox(
          height: 148,
          child: PageView.builder(
            controller: _controller,
            itemCount: promotions.length,
            onPageChanged: (index) => setState(() => _index = index),
            itemBuilder: (_, index) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
              child: _PromoCard(promotion: promotions[index]),
            ),
          ),
        ),
        if (promotions.length > 1) ...[
          const SizedBox(height: AppSpacing.xs),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < promotions.length; i++)
                Container(
                  width: i == _index ? 18 : 6,
                  height: 6,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: BoxDecoration(
                    color: i == _index
                        ? context.accentColor
                        : context.borderColor,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _PromoCard extends StatelessWidget {
  const _PromoCard({required this.promotion});

  final MarketplacePromotion promotion;

  @override
  Widget build(BuildContext context) {
    final imageUrl = AppEnvironment.resolveMediaUrl(promotion.imageUrl);
    final atelierId = promotion.atelierId;

    return GestureDetector(
      onTap: atelierId == null
          ? null
          : () => context.push('${AppRoutes.clientAtelierDetail}/$atelierId'),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppSpacing.radiusContainer),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (imageUrl.isEmpty)
              ColoredBox(color: context.surfaceLightColor)
            else
              Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) =>
                    ColoredBox(color: context.surfaceLightColor),
              ),
            // Le texte doit rester lisible sur n'importe quelle photo.
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [Color(0xCC000000), Color(0x33000000)],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    promotion.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.h4.copyWith(color: Colors.white),
                  ),
                  if (promotion.subtitle?.trim().isNotEmpty == true) ...[
                    const SizedBox(height: 4),
                    Text(
                      promotion.subtitle!.trim(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: Colors.white70,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
