import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Compatibility name for the app's standard create action.
class WhimsicalFab extends StatelessWidget {
  const WhimsicalFab({
    super.key,
    required this.onPressed,
    required this.icon,
    this.label,
    this.tooltip,
    this.backgroundColor,
    this.foregroundColor,
    this.heroTag,
  });

  final VoidCallback? onPressed;
  final Widget icon;
  final String? label;
  final String? tooltip;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final Object? heroTag;

  @override
  Widget build(BuildContext context) {
    final background = backgroundColor ?? Theme.of(context).colorScheme.primary;
    final foreground =
        foregroundColor ?? Theme.of(context).colorScheme.onPrimary;
    final fab = label == null
        ? FloatingActionButton(
            heroTag: heroTag,
            onPressed: onPressed == null
                ? null
                : () {
                    HapticFeedback.mediumImpact();
                    onPressed?.call();
                  },
            backgroundColor: background,
            foregroundColor: foreground,
            child: icon,
          )
        : FloatingActionButton.extended(
            heroTag: heroTag,
            onPressed: onPressed == null
                ? null
                : () {
                    HapticFeedback.mediumImpact();
                    onPressed?.call();
                  },
            backgroundColor: background,
            foregroundColor: foreground,
            icon: icon,
            label: Text(label!),
          );
    return tooltip == null ? fab : Tooltip(message: tooltip!, child: fab);
  }
}

class WhimsicalFabAction {
  const WhimsicalFabAction({
    required this.icon,
    this.label,
    this.tooltip,
    this.onPressed,
    this.backgroundColor,
  });

  final Widget icon;
  final String? label;
  final String? tooltip;
  final VoidCallback? onPressed;
  final Color? backgroundColor;
}
