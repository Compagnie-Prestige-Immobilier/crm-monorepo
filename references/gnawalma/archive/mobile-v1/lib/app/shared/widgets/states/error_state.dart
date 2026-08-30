import 'package:flutter/material.dart';

import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_assets.dart';
import '../layouts/polished_page.dart';

/// Recoverable, user-facing error state. Internal exception text is not shown
/// by default because stack traces are not product copy and may disclose data.
class ErrorState extends StatelessWidget {
  const ErrorState({
    super.key,
    this.message,
    this.onRetry,
    this.showTechnicalDetails = false,
    this.technicalMessage,
    this.isNetworkError = false,
    this.compact = false,
  });

  final String? message;
  final VoidCallback? onRetry;
  final bool showTechnicalDetails;
  final String? technicalMessage;
  final bool isNetworkError;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final displayMessage =
        message ??
        (isNetworkError
            ? 'La connexion au service est indisponible.'
            : 'Cette page ne peut pas être chargée pour le moment.');

    return Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.all(compact ? AppSpacing.lg : AppSpacing.xl),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (!compact)
                Image.asset(
                  isNetworkError
                      ? AppAssets.stateErrorNetwork
                      : AppAssets.stateError,
                  width: 150,
                  height: 130,
                  fit: BoxFit.contain,
                  errorBuilder: (_, _, _) => const SizedBox.shrink(),
                ),
              Container(
                width: compact ? 74 : 88,
                height: compact ? 74 : 88,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(compact ? 22 : 27),
                  border: Border.all(
                    color: AppColors.error.withValues(alpha: 0.18),
                  ),
                ),
                child: Icon(
                  isNetworkError
                      ? Icons.wifi_off_rounded
                      : Icons.error_outline_rounded,
                  color: AppColors.error,
                  size: compact ? 34 : 40,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                isNetworkError
                    ? 'Connexion indisponible'
                    : 'Chargement impossible',
                style: (compact ? AppTextStyles.h4 : AppTextStyles.h3).copyWith(
                  color: context.textPrimaryColor,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                displayMessage,
                style: AppTextStyles.bodyMedium.copyWith(
                  color: context.textSecondaryColor,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              if (showTechnicalDetails &&
                  technicalMessage != null &&
                  technicalMessage!.trim().isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                AppSectionSurface(
                  child: ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    childrenPadding: const EdgeInsets.only(top: AppSpacing.sm),
                    title: const Text('Informations de diagnostic'),
                    children: [
                      SelectableText(
                        technicalMessage!,
                        style: AppTextStyles.bodySmall.copyWith(
                          color: context.textSecondaryColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if (onRetry != null) ...[
                const SizedBox(height: AppSpacing.lg),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Réessayer'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
