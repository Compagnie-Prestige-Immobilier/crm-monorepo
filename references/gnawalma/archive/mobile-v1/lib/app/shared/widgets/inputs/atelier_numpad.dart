import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_colors_extensions.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_text_styles.dart';

class AtelierNumpad extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onNext;
  final VoidCallback onBack;

  const AtelierNumpad({
    super.key,
    required this.controller,
    required this.onNext,
    required this.onBack,
  });

  void _onKeyPress(String val) {
    HapticFeedback.lightImpact();
    if (val == '.') {
      if (!controller.text.contains('.')) {
        controller.text += val;
      }
    } else {
      controller.text += val;
    }
  }

  void _onModifier(int amount) {
    HapticFeedback.mediumImpact();
    final current = double.tryParse(controller.text) ?? 0.0;
    controller.text = (current + amount)
        .toStringAsFixed(1)
        .replaceAll(RegExp(r'\.0$'), '');
  }

  void _onFraction(String frac) {
    final currentStr = controller.text;
    if (currentStr.isEmpty) {
      controller.text = '0$frac';
      return;
    }
    final parts = currentStr.split('.');
    controller.text = '${parts[0]}$frac';
  }

  void _onDelete() {
    HapticFeedback.selectionClick();
    if (controller.text.isNotEmpty) {
      controller.text = controller.text.substring(
        0,
        controller.text.length - 1,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: context.surfaceColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              IconButton(
                tooltip: 'Mesure précédente',
                onPressed: onBack,
                icon: const Icon(Icons.chevron_left_rounded),
              ),
              Expanded(
                child: Center(
                  child: Text(
                    'Entrée de mesure',
                    // Slate is 3.4:1 on the dark surface; the theme's secondary
                    // ink is 7.5:1 there and identical in light mode.
                    style: AppTextStyles.label.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Mesure suivante',
                onPressed: onNext,
                icon: Icon(
                  Icons.chevron_right_rounded,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 3,
                child: Column(
                  children: [
                    _buildRow(context, ['1', '2', '3']),
                    _buildRow(context, ['4', '5', '6']),
                    _buildRow(context, ['7', '8', '9']),
                    _buildRow(context, ['.', '0', '⌫']),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  children: [
                    _buildModifier(context, '.0', () => _onFraction('.0')),
                    _buildModifier(context, '.5', () => _onFraction('.5')),
                    _buildModifier(context, '.75', () => _onFraction('.75')),
                    const SizedBox(height: AppSpacing.sm),
                    _buildModifier(
                      context,
                      '+1',
                      () => _onModifier(1),
                      isAdd: true,
                    ),
                    _buildModifier(
                      context,
                      '+2',
                      () => _onModifier(2),
                      isAdd: true,
                    ),
                    _buildModifier(
                      context,
                      '+3',
                      () => _onModifier(3),
                      isAdd: true,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRow(BuildContext context, List<String> keys) {
    return Row(
      children: keys
          .map((k) => Expanded(child: _buildKey(context, k)))
          .toList(),
    );
  }

  Widget _buildKey(BuildContext context, String label) {
    return Padding(
      padding: const EdgeInsets.all(4),
      child: Material(
        color: label == '⌫'
            ? Colors.transparent
            : Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
        child: InkWell(
          onTap: label == '⌫' ? _onDelete : () => _onKeyPress(label),
          borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
          child: Container(
            height: 60,
            alignment: Alignment.center,
            child: Text(
              label,
              style: AppTextStyles.h3.copyWith(
                color: label == '⌫'
                    ? AppColors.error
                    : Theme.of(context).colorScheme.onPrimaryContainer,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildModifier(
    BuildContext context,
    String label,
    VoidCallback onTap, {
    bool isAdd = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Material(
        color: isAdd
            ? Theme.of(context).colorScheme.primary
            : Theme.of(context).colorScheme.primary.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
          child: Container(
            width: double.infinity,
            height: 44,
            alignment: Alignment.center,
            child: Text(
              label,
              style: AppTextStyles.caption.copyWith(
                color: Theme.of(context).colorScheme.onPrimary,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
