import 'package:flutter/material.dart';

import '../../theme/app_colors_extensions.dart';
import '../../theme/app_text_styles.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_motion.dart';

class ToggleSwitchOption<T> extends StatelessWidget {
  final T value;
  final T groupValue;
  final String label;
  final IconData icon;
  final ValueChanged<T> onChanged;

  const ToggleSwitchOption({
    super.key,
    required this.value,
    required this.groupValue,
    required this.label,
    required this.icon,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isSelected = value == groupValue;

    // A segmented picker with no Semantics wrapper reads to a screen reader as
    // an icon and a line of static text — not as a control, and with no
    // indication of which of the two options is active.
    return Expanded(
      child: Semantics(
        button: true,
        selected: isSelected,
        label: label,
        excludeSemantics: true,
        child: GestureDetector(
          onTap: () => onChanged(value),
          child: AnimatedContainer(
            duration: AppMotion.quick,
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: isSelected
                  ? Theme.of(context).colorScheme.primary
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  size: 18,
                  color: isSelected
                      ? Theme.of(context).colorScheme.onPrimary
                      : context.textSecondaryColor,
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.caption.copyWith(
                      fontWeight: FontWeight.bold,
                      color: isSelected
                          ? Theme.of(context).colorScheme.onPrimary
                          : context.textSecondaryColor,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
