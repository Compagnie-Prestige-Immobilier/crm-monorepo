import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gnawalma/app/shared/theme/app_colors_extensions.dart';
import 'package:gnawalma/app/shared/theme/app_typography.dart';

/// A phone-native keypad.
///
/// The reference lock screens (Wise, Revolut) render the digits large and bare
/// on the page — no filled button discs — with only a ripple on press. The old
/// pad filled every key with a solid colour, which on a white background was
/// either invisible (white keys) or a wall of blue.
class PinNumpad extends StatelessWidget {
  final void Function(int) onDigit;
  final VoidCallback onBack;

  /// Retained for call-site compatibility; unused now that keys are bare.
  final Color? buttonColor;
  final Color? textColor;

  const PinNumpad({
    super.key,
    required this.onDigit,
    required this.onBack,
    this.buttonColor,
    this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _row(context, [1, 2, 3]),
        _row(context, [4, 5, 6]),
        _row(context, [7, 8, 9]),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(width: 84, height: 76),
            _digit(context, 0),
            _KeySlot(
              onTap: () {
                HapticFeedback.selectionClick();
                onBack();
              },
              semanticLabel: 'Effacer',
              child: Icon(
                Icons.backspace_outlined,
                color: textColor ?? context.textPrimaryColor,
                size: 26,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _row(BuildContext context, List<int> numbers) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: numbers.map((n) => _digit(context, n)).toList(),
    );
  }

  Widget _digit(BuildContext context, int number) {
    return _KeySlot(
      onTap: () {
        HapticFeedback.selectionClick();
        onDigit(number);
      },
      semanticLabel: '$number',
      child: Text(
        '$number',
        style: AppTypography.display(
          size: 30,
          weight: 500,
          color: textColor ?? context.textPrimaryColor,
        ),
      ),
    );
  }
}

class _KeySlot extends StatelessWidget {
  const _KeySlot({
    required this.onTap,
    required this.child,
    required this.semanticLabel,
  });

  final VoidCallback onTap;
  final Widget child;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: SizedBox(
        width: 84,
        height: 76,
        child: InkResponse(
          onTap: onTap,
          radius: 40,
          highlightShape: BoxShape.circle,
          containedInkWell: false,
          child: Center(child: child),
        ),
      ),
    );
  }
}
