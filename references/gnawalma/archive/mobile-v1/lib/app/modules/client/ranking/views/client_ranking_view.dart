import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../routes/app_routes.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../core/location/location_service.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../discovery/controllers/marketplace_providers.dart';
import '../../shared/widgets/client_ui.dart';
import '../domain/ranked_atelier.dart';

/// Le classement des couturiers (§2.4).
///
/// Deux périmètres, comme le cahier des charges les nomme : général, et par
/// zone géographique. L'ordre est une moyenne pondérée par le nombre d'avis —
/// sans quoi un atelier noté 5,0 par un seul client passerait devant un atelier
/// noté 4,7 par quarante, ce qui récompenserait l'absence de recul plutôt que
/// le travail.
class ClientRankingView extends ConsumerStatefulWidget {
  const ClientRankingView({super.key});

  @override
  ConsumerState<ClientRankingView> createState() => _ClientRankingViewState();
}

class _ClientRankingViewState extends ConsumerState<ClientRankingView> {
  RankingScope _scope = RankingScope.general;

  @override
  Widget build(BuildContext context) {
    final location = ref.watch(locationControllerProvider);
    final ranking = ref.watch(marketplaceRankingProvider(_scope));

    return Scaffold(
      appBar: AppBar(title: const Text('Classement')),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter,
                AppSpacing.sm,
                AppSpacing.gutter,
                AppSpacing.sm,
              ),
              // « Autour de moi » n'est proposé qu'avec une position : sans
              // elle, l'onglet mesurait depuis le centre de Dakar.
              child: SegmentedButton<bool>(
                showSelectedIcon: false,
                segments: [
                  const ButtonSegment(value: false, label: Text('Général')),
                  ButtonSegment(
                    value: true,
                    label: const Text('Autour de moi'),
                    enabled: location.hasPosition,
                  ),
                ],
                selected: {_scope.isScoped},
                onSelectionChanged: (selection) => setState(
                  () => _scope = selection.first && location.hasPosition
                      ? RankingScope.around(
                          location.latitude!,
                          location.longitude!,
                        )
                      : RankingScope.general,
                ),
              ),
            ),
            Expanded(
              child: ranking.when(
                loading: () => const ClientLoadingList(itemCount: 6),
                error: (_, _) => ClientStatePanel(
                  motif: AtelierMotif.nodata,
                  icon: Icons.leaderboard_outlined,
                  title: 'Classement indisponible',
                  message:
                      'Il n’a pas pu être chargé. Vérifiez la connexion puis réessayez.',
                  actionLabel: 'Réessayer',
                  onAction: () =>
                      ref.invalidate(marketplaceRankingProvider(_scope)),
                ),
                data: (items) => items.isEmpty
                    ? ClientStatePanel(
                        motif: AtelierMotif.search,
                        icon: Icons.leaderboard_outlined,
                        title: _scope.isScoped
                            ? 'Aucun atelier dans cette zone'
                            : 'Aucun atelier classé',
                        message: _scope.isScoped
                            ? 'Essayez le classement général.'
                            : 'Le classement apparaîtra dès que des ateliers seront publiés.',
                        actionLabel: _scope.isScoped ? 'Voir le général' : null,
                        onAction: _scope.isScoped
                            ? () =>
                                  setState(() => _scope = RankingScope.general)
                            : null,
                      )
                    : RefreshIndicator(
                        onRefresh: () async {
                          ref.invalidate(marketplaceRankingProvider(_scope));
                          await ref.read(
                            marketplaceRankingProvider(_scope).future,
                          );
                        },
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.gutter,
                            0,
                            AppSpacing.gutter,
                            AppSpacing.sectionSpacing,
                          ),
                          itemCount: items.length + 1,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: AppSpacing.sm),
                          itemBuilder: (_, index) {
                            if (index == items.length) {
                              return const _RankingNote();
                            }
                            return _RankRow(atelier: items[index]);
                          },
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RankRow extends StatelessWidget {
  const _RankRow({required this.atelier});

  final RankedAtelier atelier;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Les trois premiers portent l'encre pleine. Pas de médailles colorées : la
    // couleur est réservée au statut dans tout le reste de l'application.
    final isPodium = atelier.rank <= 3;

    return PressableSurface(
      onTap: () =>
          context.push('${AppRoutes.clientAtelierDetail}/${atelier.id}'),
      semanticLabel: atelier.hasRating
          ? '${atelier.rank}. ${atelier.name}, note ${atelier.rating.toStringAsFixed(1)} sur ${atelier.reviewCount} avis'
          : '${atelier.rank}. ${atelier.name}, pas encore d’avis',
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: isPodium ? theme.colorScheme.onSurface : null,
              border: isPodium
                  ? null
                  : Border.all(color: theme.colorScheme.outlineVariant),
              shape: BoxShape.circle,
            ),
            child: Text(
              '${atelier.rank}',
              style: AppTextStyles.numeric.copyWith(
                color: isPodium
                    ? theme.colorScheme.surface
                    : context.textSecondaryColor,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  atelier.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall,
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  atelier.specialtyLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (atelier.hasRating) ...[
                Row(
                  children: [
                    Icon(
                      Icons.star_rounded,
                      size: 16,
                      color: context.textPrimaryColor,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      atelier.rating.toStringAsFixed(1),
                      style: AppTextStyles.label.copyWith(
                        color: context.textPrimaryColor,
                      ),
                    ),
                  ],
                ),
                Text(
                  '${atelier.reviewCount} avis',
                  style: AppTextStyles.caption.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ] else
                // « 0,0 » ferait passer pour mauvais un atelier que personne
                // n'a encore jugé.
                Text(
                  'Pas encore\nd’avis',
                  textAlign: TextAlign.right,
                  style: AppTextStyles.caption.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Dit comment l'ordre est calculé.
///
/// Un classement dont la règle est cachée se lit comme un favoritisme, et c'est
/// exactement le reproche qu'un couturier mal classé adressera à la plateforme.
class _RankingNote extends StatelessWidget {
  const _RankingNote();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.md),
      child: Text(
        'Le classement tient compte de la note et du nombre d’avis : une note '
        'excellente sur un seul avis ne passe pas devant une très bonne note '
        'sur des dizaines. Seuls les avis publiés après une prestation '
        'confirmée sont comptés.',
        style: AppTextStyles.caption.copyWith(
          color: context.textSecondaryColor,
          height: 1.5,
        ),
      ),
    );
  }
}
