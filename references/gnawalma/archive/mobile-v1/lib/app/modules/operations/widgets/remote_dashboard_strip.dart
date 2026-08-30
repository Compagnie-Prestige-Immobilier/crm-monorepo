import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_money.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../controllers/operations_providers.dart';
import '../domain/operations_models.dart';

class RemoteDashboardStrip extends ConsumerWidget {
  const RemoteDashboardStrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final atelier = ref.watch(primaryRemoteAtelierProvider);

    return atelier.when(
      loading: () => const _LoadingStrip(),
      error: (_, _) => _SyncIssue(
        message: 'Les indicateurs serveur sont momentanément indisponibles.',
        onRetry: () {
          ref.invalidate(remoteAteliersProvider);
          ref.invalidate(primaryRemoteAtelierProvider);
        },
      ),
      data: (item) {
        if (item == null) {
          return const _SyncIssue(
            message: 'Aucun atelier serveur n’est associé à ce compte.',
          );
        }
        final summary = ref.watch(remoteDashboardProvider(item.id));
        return summary.when(
          loading: () => const _LoadingStrip(),
          error: (_, _) => _SyncIssue(
            message: 'Le résumé serveur n’a pas pu être actualisé.',
            onRetry: () => ref.invalidate(remoteDashboardProvider(item.id)),
          ),
          data: (value) => _SummaryCard(atelier: item, summary: value),
        );
      },
    );
  }
}

class _SummaryCard extends ConsumerWidget {
  const _SummaryCard({required this.atelier, required this.summary});

  final RemoteAtelier atelier;
  final OperationsDashboardSummary summary;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    final metrics = [
      _MetricData('En cours', summary.activeOrders),
      _MetricData('Prêtes', summary.readyOrders),
      _MetricData('En retard', summary.overdueOrders),
      _MetricData('Clients', summary.clientsCount),
    ];

    return AppSectionSurface(
      child: Column(
        children: [
          Row(
            children: [
              // Bare glyph, ink not accent — matches `AppSectionHeader` and the
              // publication card right above this one. The tinted circle this
              // replaced was the only coloured icon tile on the dashboard.
              Icon(
                Icons.cloud_done_outlined,
                size: 20,
                color: context.textPrimaryColor,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Données synchronisées',
                      style: AppTextStyles.label.copyWith(
                        color: context.textPrimaryColor,
                      ),
                    ),
                    Text(
                      atelier.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: context.textSecondaryColor,
                      ),
                    ),
                  ],
                ),
              ),
              // The publication state is stated once, by the card above
              // (`AtelierMarketplaceStrip`), which also says what to do about
              // it. This badge said "À compléter" directly under that card's
              // "En cours de vérification" — two verdicts on one fact, neither
              // of them actionable here.
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              for (var index = 0; index < metrics.length; index++) ...[
                Expanded(child: _Metric(data: metrics[index])),
                if (index < metrics.length - 1)
                  Container(width: 1, height: 34, color: context.dividerColor),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Icon(
                Icons.payments_outlined,
                size: 18,
                color: context.statusForeground(AppColors.success),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Reçu aujourd’hui',
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ),
              Text(
                money.format(summary.receivedTodayCfa),
                style: AppTextStyles.label.copyWith(
                  color: context.textPrimaryColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricData {
  const _MetricData(this.label, this.value);

  final String label;
  final int value;
}

class _Metric extends StatelessWidget {
  const _Metric({required this.data});

  final _MetricData data;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '${data.value}',
            style: AppTextStyles.h4.copyWith(color: context.textPrimaryColor),
          ),
          const SizedBox(height: 1),
          Text(
            data.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: AppTextStyles.caption.copyWith(
              color: context.textSecondaryColor,
              fontSize: 10.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _LoadingStrip extends StatelessWidget {
  const _LoadingStrip();

  @override
  Widget build(BuildContext context) {
    return AppSectionSurface(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.gutter,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: [
          const SizedBox.square(
            dimension: 18,
            child: CircularProgressIndicator.adaptive(),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            'Actualisation des données…',
            style: AppTextStyles.bodySmall.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
        ],
      ),
    );
  }
}

class _SyncIssue extends StatelessWidget {
  const _SyncIssue({required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return AppStatusBanner(
      title: 'Données serveur indisponibles',
      message: message,
      icon: Icons.cloud_off_rounded,
      tone: AppStatusTone.warning,
      actionLabel: onRetry == null ? null : 'Réessayer',
      onAction: onRetry,
      compact: true,
    );
  }
}
