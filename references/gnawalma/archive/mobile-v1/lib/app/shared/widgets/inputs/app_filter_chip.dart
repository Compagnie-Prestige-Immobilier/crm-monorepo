import 'package:flutter/material.dart';

/// A selectable chip that actually wears the space accent.
///
/// Material 3's `FilterChip` does **not** read `ChipThemeData.selectedColor`
/// for its selected container — it resolves that from its own defaults. The
/// symptom is subtle and was reproduced by sampling device pixels: on a screen
/// whose theme was verifiably the client's, `colorScheme.primary` rendered as
/// `#CF3D19` everywhere except the selected chip, which came out `#1171B8` —
/// the *other* space's accent — in the same frame.
///
/// So the colours are passed explicitly here, resolved from the scheme, in one
/// place. Six screens used raw `FilterChip`/`ChoiceChip` and every one of them
/// had the defect; patching them individually would have left the next one to
/// rediscover it.
class AppFilterChip extends StatelessWidget {
  const AppFilterChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onSelected,
    this.icon,
  });

  final String label;
  final bool selected;

  /// Null disables the chip.
  final ValueChanged<bool>? onSelected;

  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final foreground = selected ? scheme.onPrimary : scheme.onSurface;

    return FilterChip(
      selected: selected,
      onSelected: onSelected,
      avatar: icon == null ? null : Icon(icon, size: 16, color: foreground),
      label: Text(label),
      selectedColor: scheme.primary,
      checkmarkColor: scheme.onPrimary,
      labelStyle: TextStyle(
        color: foreground,
        fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
      ),
      // Set alongside `avatar` because the avatar's own colour wins for an
      // Icon, while this covers any other icon the chip renders itself.
      iconTheme: IconThemeData(color: foreground, size: 16),
    );
  }
}
