import 'package:flutter/material.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

/// Le pastillage d'AppBar : une icône, un compteur, une cible de 48 dp.
///
/// `SyncBadge` et `NotificationBell` en étaient deux copies divergeant de 2 px
/// d'icône, côte à côte dans la même barre.
class CpiAppBarBadge extends StatelessWidget {
  const CpiAppBarBadge({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.count = 0,
    this.emphasis = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final int count;
  final bool emphasis;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final Color color = emphasis
        ? context.cpi.accentOnDark
        : theme.colorScheme.onPrimary;

    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: CpiRadius.brFull,
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minWidth: kCpiMinTouchTarget,
            minHeight: kCpiMinTouchTarget,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: CpiSpacing.sm,
              vertical: CpiSpacing.xs,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                AnimatedSwitcher(
                  duration: CpiMotion.of(context).micro,
                  switchInCurve: CpiMotion.of(context).easeSpring,
                  transitionBuilder: (Widget child, Animation<double> a) =>
                      ScaleTransition(scale: a, child: child),
                  child: Icon(
                    icon,
                    key: ValueKey<IconData>(icon),
                    size: CpiIconSize.md,
                    color: color,
                  ),
                ),
                if (count > 0) ...<Widget>[
                  const SizedBox(width: CpiSpacing.xxsPlus),
                  Text(
                    count > 99 ? '99+' : '$count',
                    style: theme.textTheme.labelLarge?.copyWith(color: color),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
