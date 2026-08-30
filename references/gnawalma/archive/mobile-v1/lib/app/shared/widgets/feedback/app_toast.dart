import 'package:flutter/material.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_text_styles.dart';
import '../../theme/app_spacing.dart';

enum ToastType { info, success, warning, error }

class AppToast extends StatelessWidget {
  final String title;
  final String message;
  final ToastType type;
  final VoidCallback? onTap;

  const AppToast({
    super.key,
    required this.title,
    required this.message,
    this.type = ToastType.info,
    this.onTap,
  });

  static void show({
    required String title,
    required String message,
    ToastType type = ToastType.info,
    Duration duration = const Duration(seconds: 3),
  }) {
    final context = AppNavigator.navigatorKey.currentContext;
    if (context == null) return;

    final scaffoldMessenger = ScaffoldMessenger.of(context);
    final background = _getColor(context, type);
    final foreground = type == ToastType.info
        ? Theme.of(context).colorScheme.onPrimary
        : Colors.white;

    scaffoldMessenger.showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: foreground.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(_getIcon(type), color: foreground, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTextStyles.bodyLarge.copyWith(
                      color: foreground,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    message,
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: foreground.withValues(alpha: 0.9),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        backgroundColor: background,
        duration: duration,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusContainer),
        ),
        elevation: 8,
      ),
    );
  }

  static Color _getColor(BuildContext context, ToastType type) {
    switch (type) {
      case ToastType.success:
        return AppColors.success;
      case ToastType.warning:
        return AppColors.warning;
      case ToastType.error:
        return AppColors.error;
      case ToastType.info:
        return Theme.of(context).colorScheme.primary;
    }
  }

  static IconData _getIcon(ToastType type) {
    switch (type) {
      case ToastType.success:
        return Icons.check_rounded;
      case ToastType.warning:
        return Icons.warning_rounded;
      case ToastType.error:
        return Icons.error_outline_rounded;
      case ToastType.info:
        return Icons.info_outline_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}
