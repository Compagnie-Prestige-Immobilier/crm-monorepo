import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../utils/app_assets.dart';
import '../feedback/notification_bell_button.dart';

/// Compact route app bar. Large page hierarchy belongs in the page body; this
/// bar handles navigation, context and actions without decorative chrome.
class CustomAppBar extends ConsumerWidget implements PreferredSizeWidget {
  const CustomAppBar({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.actions,
    this.showBackButton = false,
    this.onBackPressed,
    this.hasGradient = false,
    this.backgroundColor,
    this.elevation,
    this.bottom,
    this.showStatusBadge = false,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;
  final List<Widget>? actions;
  final bool showBackButton;
  final VoidCallback? onBackPressed;
  final bool hasGradient;
  final Color? backgroundColor;
  final double? elevation;
  final PreferredSizeWidget? bottom;
  final bool showStatusBadge;

  @override
  Size get preferredSize =>
      Size.fromHeight(64 + (bottom?.preferredSize.height ?? 0));

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final foreground = hasGradient
        ? scheme.onPrimary
        : context.textPrimaryColor;
    final background = hasGradient
        ? backgroundColor ?? scheme.primary
        : backgroundColor ?? context.backgroundColor;
    // A left-pointing arrow is the Android back affordance; iOS expects the
    // chevron that pairs with the interactive edge-swipe.
    final platform = Theme.of(context).platform;
    final isCupertino =
        platform == TargetPlatform.iOS || platform == TargetPlatform.macOS;

    return AppBar(
      surfaceTintColor: Colors.transparent,
      backgroundColor: background,
      foregroundColor: foreground,
      elevation: elevation ?? 0,
      scrolledUnderElevation: 0,
      toolbarHeight: 64,
      centerTitle: false,
      leadingWidth: 56,
      titleSpacing: showBackButton || leading != null ? 0 : AppSpacing.md,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.h4.copyWith(color: foreground),
          ),
          if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              subtitle!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.bodySmall.copyWith(
                color: foreground.withValues(alpha: 0.72),
              ),
            ),
          ],
        ],
      ),
      leading: showBackButton
          ? IconButton(
              tooltip: 'Retour',
              onPressed:
                  onBackPressed ??
                  () {
                    if (context.canPop()) context.pop();
                  },
              icon: isCupertino
                  ? Icon(
                      Icons.arrow_back_ios_new_rounded,
                      size: 20,
                      color: foreground,
                    )
                  : Image.asset(
                      AppAssets.actionBack,
                      width: 22,
                      height: 22,
                      color: foreground,
                      errorBuilder: (_, _, _) =>
                          Icon(Icons.arrow_back_rounded, color: foreground),
                    ),
            )
          : leading,
      actions: [
        if (actions != null) ...actions!,
        if (showStatusBadge) const NotificationBellButton(),
        const SizedBox(width: AppSpacing.xs),
      ],
      bottom: bottom,
    );
  }
}
