import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../routes/app_routes.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../controllers/auth_controller.dart';

/// Asks, then signs out and returns to the authentication screen.
///
/// Shared because the two spaces used to disagree: the client profile had this
/// sheet, and the atelier space had no sign-out at all — the only way out was
/// the "forgotten PIN" branch, which most owners never see. What each space
/// leaves behind differs, so only that sentence is a parameter.
Future<void> confirmLogout(
  BuildContext context,
  WidgetRef ref, {
  required String retainedTitle,
  required String retainedMessage,
}) async {
  final confirmed = await showModalBottomSheet<bool>(
    context: context,
    showDragHandle: true,
    useSafeArea: true,
    builder: (sheetContext) => Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        0,
        AppSpacing.md,
        AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppSectionHeader(
            title: 'Se déconnecter ?',
            subtitle:
                'Le compte devra être authentifié de nouveau sur cet appareil.',
            icon: Icons.logout_rounded,
            accentColor: Theme.of(sheetContext).colorScheme.error,
          ),
          const SizedBox(height: AppSpacing.md),
          AppStatusBanner(
            title: retainedTitle,
            message: retainedMessage,
            icon: Icons.info_outline_rounded,
            tone: AppStatusTone.info,
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(sheetContext, false),
                  child: const Text('Annuler'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: FilledButton(
                  onPressed: () => Navigator.pop(sheetContext, true),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.error,
                  ),
                  child: const Text('Se déconnecter'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
  if (confirmed != true) return;

  await ref.read(authActionControllerProvider.notifier).logout();
  if (context.mounted) context.go(AppRoutes.auth);
}
