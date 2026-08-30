import 'package:flutter/material.dart';

import '../../theme/app_colors_extensions.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_motion.dart';

/// Primary action with explicit enabled/loading transitions.
///
/// This keeps the button visually stable while its label, progress indicator
/// and disabled state change. Native Material press/ripple feedback is retained.
class AnimatedPrimaryButton extends StatelessWidget {
  const AnimatedPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    required this.enabled,
    this.loading = false,
    this.backgroundColor,
    this.icon,
    this.height = 56,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool enabled;
  final bool loading;
  final Color? backgroundColor;
  final IconData? icon;
  final double height;

  @override
  Widget build(BuildContext context) {
    final canPress = enabled && !loading;

    return Semantics(
      button: true,
      enabled: canPress,
      label: label,
      child: AnimatedScale(
        scale: canPress ? 1 : 0.995,
        duration: AppMotion.exit,
        curve: Curves.easeOutCubic,
        child: SizedBox(
          width: double.infinity,
          height: height,
          child: FilledButton(
            onPressed: canPress ? onPressed : null,
            // Shape and text come from filledButtonTheme so this stays the same
            // control as every other primary action.
            style: FilledButton.styleFrom(
              backgroundColor: backgroundColor,
              disabledBackgroundColor: context.borderColor.withValues(
                alpha: 0.72,
              ),
              disabledForegroundColor: context.textSecondaryColor.withValues(
                alpha: 0.72,
              ),
            ),
            child: AnimatedSwitcher(
              duration: AppMotion.quick,
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: ScaleTransition(scale: animation, child: child),
              ),
              child: loading
                  ? SizedBox(
                      key: const ValueKey('loading'),
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator.adaptive(
                        valueColor: AlwaysStoppedAnimation(
                          Theme.of(context).colorScheme.onPrimary,
                        ),
                      ),
                    )
                  : Row(
                      key: ValueKey('label'),
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (icon != null) ...[
                          Icon(icon, size: 20),
                          const SizedBox(width: AppSpacing.xs),
                        ],
                        Flexible(
                          child: Text(
                            label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
