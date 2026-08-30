import 'package:flutter/material.dart';
import 'package:gnawalma/app/shared/theme/app_colors_extensions.dart';

class PinDots extends StatelessWidget {
  final int length;
  final int currentLength;
  final double size;
  final Color? color;

  const PinDots({
    super.key,
    this.length = 4,
    required this.currentLength,
    this.size = 16,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final dotColor =
        color ??
        (context.isDarkTheme ? Colors.white : Theme.of(context).primaryColor);

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(length, (index) {
        final isFilled = index < currentLength;
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 12),
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isFilled ? dotColor : dotColor.withValues(alpha: 0.3),
            border: Border.all(color: dotColor, width: 2),
          ),
        );
      }),
    );
  }
}
