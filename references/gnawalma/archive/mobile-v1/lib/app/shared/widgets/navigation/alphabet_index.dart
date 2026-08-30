import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_colors_extensions.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_motion.dart';

/// Alphabet Index Widget
///
/// A sticky alphabet index for contacts-style scrolling.
/// Provides haptic feedback on letter selection.
class AlphabetIndex extends StatefulWidget {
  final List<String> letters;
  final ValueChanged<String> onLetterSelected;
  final String? currentLetter;
  final double? height;

  const AlphabetIndex({
    super.key,
    required this.letters,
    required this.onLetterSelected,
    this.currentLetter,
    this.height,
  });

  @override
  State<AlphabetIndex> createState() => _AlphabetIndexState();
}

class _AlphabetIndexState extends State<AlphabetIndex> {
  String? _hoveredLetter;
  bool _isDragging = false;

  void _handlePanStart(DragStartDetails details) {
    setState(() => _isDragging = true);
    _selectLetterFromPosition(details.localPosition);
  }

  void _handlePanUpdate(DragUpdateDetails details) {
    _selectLetterFromPosition(details.localPosition);
  }

  void _handlePanEnd(DragEndDetails details) {
    setState(() {
      _isDragging = false;
      _hoveredLetter = null;
    });
  }

  void _selectLetterFromPosition(Offset position) {
    final RenderBox box = context.findRenderObject() as RenderBox;
    final letterHeight = box.size.height / widget.letters.length;
    final index = (position.dy / letterHeight).floor();

    if (index >= 0 && index < widget.letters.length) {
      final letter = widget.letters[index];
      if (letter != _hoveredLetter) {
        setState(() => _hoveredLetter = letter);
        HapticFeedback.selectionClick();
        widget.onLetterSelected(letter);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // The rail is one continuous drag surface (like the iOS contacts index):
    // individual letters cannot each be 44pt tall, so the accessible target is
    // the whole 44pt-wide rail, with letter rows tiling its full height.
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onPanStart: _handlePanStart,
      onPanUpdate: _handlePanUpdate,
      onPanEnd: _handlePanEnd,
      child: Container(
        width: 44,
        height: widget.height,
        alignment: Alignment.centerRight,
        child: Container(
          width: 24,
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
          decoration: BoxDecoration(
            color: _isDragging
                ? scheme.primary.withValues(alpha: 0.1)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
          ),
          child: Column(
            children: widget.letters.map((letter) {
              final isActive = letter == widget.currentLetter;
              final isHovered = letter == _hoveredLetter && _isDragging;

              return Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    widget.onLetterSelected(letter);
                  },
                  child: Center(
                    child: AnimatedContainer(
                      duration: AppMotion.exit,
                      width: isHovered ? 22 : 20,
                      height: isHovered ? 22 : 16,
                      decoration: isActive || isHovered
                          ? BoxDecoration(
                              color: scheme.primary,
                              shape: BoxShape.circle,
                            )
                          : null,
                      child: Center(
                        child: Text(
                          letter,
                          style: TextStyle(
                            fontSize: isHovered ? 12 : 10,
                            fontWeight: isActive || isHovered
                                ? FontWeight.w800
                                : FontWeight.w600,
                            color: isActive || isHovered
                                ? scheme.onPrimary
                                : context.textSecondaryColor,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}
