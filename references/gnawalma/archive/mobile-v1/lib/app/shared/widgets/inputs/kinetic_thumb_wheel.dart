import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_text_styles.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_motion.dart';

/// A custom kinetic thumb-wheel for "No-Keyboard" measurement entry.
///
/// Provides:
/// - Smooth vertical scrolling with inertia.
/// - Haptic feedback on every increment.
/// - Precise value selection without a keyboard.
class KineticThumbWheel extends StatefulWidget {
  final double value;
  final double min;
  final double max;
  final double step;
  final ValueChanged<double> onChanged;
  final String suffix;

  const KineticThumbWheel({
    super.key,
    required this.value,
    this.min = 0,
    this.max = 300,
    this.step = 0.5,
    required this.onChanged,
    this.suffix = 'cm',
  });

  @override
  State<KineticThumbWheel> createState() => _KineticThumbWheelState();
}

class _KineticThumbWheelState extends State<KineticThumbWheel> {
  late FixedExtentScrollController _controller;
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    final clampedValue = widget.value.clamp(widget.min, widget.max);
    _currentIndex = ((clampedValue - widget.min) / widget.step).round();
    _controller = FixedExtentScrollController(initialItem: _currentIndex);
  }

  @override
  void didUpdateWidget(KineticThumbWheel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != oldWidget.value) {
      final clampedValue = widget.value.clamp(widget.min, widget.max);
      final newIndex = ((clampedValue - widget.min) / widget.step).round();
      if (newIndex != _currentIndex) {
        _currentIndex = newIndex;
        _controller.jumpToItem(_currentIndex);
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final itemCount = ((widget.max - widget.min) / widget.step).floor() + 1;

    return Container(
      height: 120, // Reduced height for better integration in the HUD
      width: double
          .infinity, // Full width for horizontal scrolling feel in vertical space
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.02),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSheetTop),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Visual Ruler Guidelines (Horizontal style inside vertical scroll)
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppSpacing.radiusSheetTop),
              child: CustomPaint(painter: _RulerPainter()),
            ),
          ),

          // Central Selection Glow & Frame
          IgnorePointer(
            child: Container(
              height: 64,
              width: 100,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(AppSpacing.radiusContainer),
                border: Border.all(
                  color: Theme.of(
                    context,
                  ).colorScheme.primary.withValues(alpha: 0.3),
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Theme.of(
                      context,
                    ).colorScheme.primary.withValues(alpha: 0.1),
                    blurRadius: 20,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
            ),
          ),

          // Wheel
          ListWheelScrollView.useDelegate(
            controller: _controller,
            itemExtent: 64,
            diameterRatio: 1.2, // More curved feel
            physics: const FixedExtentScrollPhysics(),
            onSelectedItemChanged: (index) {
              setState(() => _currentIndex = index);
              final newValue = widget.min + (index * widget.step);
              widget.onChanged(newValue);
              HapticFeedback.selectionClick();
            },
            childDelegate: ListWheelChildBuilderDelegate(
              childCount: itemCount,
              builder: (context, index) {
                final val = widget.min + (index * widget.step);
                final isSelected = index == _currentIndex;
                final isMainMetric = val % 10 == 0;

                return Center(
                  child: AnimatedScale(
                    duration: AppMotion.quick,
                    scale: isSelected ? 1.2 : (isMainMetric ? 0.9 : 0.7),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          val.toStringAsFixed(val % 1 == 0 ? 0 : 1),
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: isSelected
                                ? FontWeight.w900
                                : FontWeight.w500,
                            color: isSelected
                                ? Theme.of(
                                    context,
                                  ).colorScheme.onPrimaryContainer
                                : (isMainMetric
                                      ? Colors.black54
                                      : Colors.grey.shade400),
                            letterSpacing: -1,
                          ),
                        ),
                        if (isSelected) ...[
                          const SizedBox(width: 4),
                          Text(
                            widget.suffix,
                            style: AppTextStyles.caption.copyWith(
                              color: Theme.of(
                                context,
                              ).colorScheme.onPrimaryContainer,
                              fontWeight: FontWeight.w900,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _RulerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black.withValues(alpha: 0.05)
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;

    const step = 8.0;
    for (double y = 0; y < size.height; y += step) {
      final isLong = (y / step) % 10 == 0;
      final isMedium = (y / step) % 5 == 0;

      final length = isLong ? 30.0 : (isMedium ? 20.0 : 10.0);

      canvas.drawLine(Offset(0, y), Offset(length, y), paint);
      canvas.drawLine(
        Offset(size.width, y),
        Offset(size.width - length, y),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
