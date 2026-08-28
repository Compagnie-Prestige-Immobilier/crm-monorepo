import 'package:flutter/material.dart';
import 'package:forui/forui.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';
import 'cpi_forui.dart';

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
    // Le même badge se pose sur un aplat de marque (AppBar) et sur une surface
    // neutre (en-tête ForUI) : la teinte d'appel se choisit sur le fond réel,
    // que seule la couleur d'icône ambiante trahit.
    final Color base =
        IconTheme.of(context).color ?? theme.colorScheme.onSurface;
    final bool onBrand =
        ThemeData.estimateBrightnessForColor(base) == Brightness.light;
    final Color color = emphasis
        ? (onBrand ? context.cpi.accentOnDark : context.cpi.accentText)
        : base;

    return Semantics(
      button: true,
      label: label,
      child: CpiForui(
        builder: (BuildContext context) => FTappable(
          onPress: onTap,
          behavior: HitTestBehavior.opaque,
          focusedOutlineStyle: const FFocusedOutlineStyleDelta.delta(
            borderRadius: CpiRadius.brFull,
          ),
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
      ),
    );
  }
}
