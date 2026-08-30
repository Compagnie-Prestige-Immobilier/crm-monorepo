import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/app_colors_extensions.dart';
import '../../theme/app_motion.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_text_styles.dart';

/// One destination in [AppNavBar].
class AppNavItem {
  const AppNavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });

  final IconData icon;
  final IconData activeIcon;

  /// Sentence case, always visible. Not a tooltip, not a caption.
  final String label;
}

/// The primary navigation bar, shared by both spaces.
///
/// There used to be two of these, plus two more that nothing referenced. The
/// client space ran a stock Material 3 `NavigationBar` with its sliding pill
/// indicator; the atelier ran a floating dock with 9.5sp capitalised labels
/// that appeared only under the selected tab. So the same product had two
/// navigation paradigms, and the atelier's violated three rules in
/// `knowledge-base/DESIGN.md` at once — floating over content, capitals, and
/// labels hidden on unselected destinations.
///
/// What this one does instead:
///
/// - Sits in `Scaffold.bottomNavigationBar` and occupies its own space. Nothing
///   scrolls underneath it, so nothing is ever hidden behind it.
/// - Shows every label, all the time, in sentence case. A label that appears
///   only once you have already arrived somewhere cannot help you decide to go
///   there.
/// - Marks the active destination with the space accent on the glyph and the
///   label, and nothing else. The pill indicator is the single most recognisably
///   Material element in a bottom bar, and it is what made the client space read
///   as an Android-template app.
///
/// Four destinations per space is the cap; see `knowledge-base/DESIGN.md`.
class AppNavBar extends StatelessWidget {
  const AppNavBar({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onSelected,
  });

  final List<AppNavItem> items;
  final int currentIndex;

  /// Called for every tap, including on the already-selected destination —
  /// which is how a tab bar resets its branch to the root.
  final ValueChanged<int> onSelected;

  /// Bar height above the safe area.
  static const double barHeight = 64.0;

  /// Total height including the system inset, for callers that need to reserve
  /// space for it.
  static double heightFor(BuildContext context) =>
      barHeight + MediaQuery.viewPaddingOf(context).bottom;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.surfaceColor,
        // A hairline, not a shadow. The bar is part of the page frame, not an
        // object hovering above it.
        border: Border(top: BorderSide(color: context.dividerColor)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: barHeight,
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: _NavDestination(
                    item: items[i],
                    selected: i == currentIndex,
                    onTap: () {
                      // Selection feedback fires on every tap, including the
                      // re-tap that resets a branch: something did happen, and
                      // the user should feel it.
                      HapticFeedback.selectionClick();
                      onSelected(i);
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavDestination extends StatelessWidget {
  const _NavDestination({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final AppNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? context.accentColor : context.textSecondaryColor;

    return Semantics(
      // `selected` carries the state; the label must not repeat it, or TalkBack
      // announces "Accueil sélectionné, sélectionné".
      //
      // The exclusion goes on the *contents*, not on this node: putting
      // `excludeSemantics: true` here drops the InkWell's tap action along with
      // the duplicate label, leaving a destination a screen reader can describe
      // but cannot activate.
      selected: selected,
      button: true,
      label: item.label,
      child: InkWell(
        onTap: onTap,
        // Bounded to the destination so the ripple cannot bleed across the bar.
        borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
        child: ExcludeSemantics(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedSwitcher(
                duration: AppMotion.duration(context, AppMotion.instant),
                child: Icon(
                  selected ? item.activeIcon : item.icon,
                  key: ValueKey(selected),
                  size: AppSpacing.iconMD,
                  color: color,
                ),
              ),
              const SizedBox(height: 4),
              // Labels never scale past 1.3 here: the bar has a fixed height, and
              // a label that wraps to two lines pushes the glyph out of it. The
              // rest of the app honours system text size in full; this is the one
              // component where the ceiling is the accessible choice.
              MediaQuery.withClampedTextScaling(
                maxScaleFactor: 1.3,
                child: Text(
                  item.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption.copyWith(
                    color: color,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
