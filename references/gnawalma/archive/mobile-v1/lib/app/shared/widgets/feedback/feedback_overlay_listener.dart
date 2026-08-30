import 'dart:collection';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/feedback_service.dart';
import '../../theme/app_colors.dart';
import 'app_feedback_bubble.dart';

/// Global listener that manages the feedback bubble queue
/// - Ensures only one bubble is shown at a time
/// - Prevents duplicate listener crashes
/// - Handles sequential display of feedback
class FeedbackOverlayListener extends ConsumerStatefulWidget {
  final Widget child;

  const FeedbackOverlayListener({super.key, required this.child});

  @override
  ConsumerState<FeedbackOverlayListener> createState() =>
      _FeedbackOverlayListenerState();
}

class _FeedbackOverlayListenerState
    extends ConsumerState<FeedbackOverlayListener> {
  final Queue<FeedbackItem> _queue = Queue<FeedbackItem>();
  bool _isShowing = false;
  DateTime? _lastTimestamp;

  @override
  Widget build(BuildContext context) {
    // Listen to the feedback service
    ref.listen(feedbackServiceProvider, (previous, next) {
      if (next.items.isNotEmpty) {
        final latest = next.items.first;

        // Only add if it's newer than what we last processed
        if (_lastTimestamp == null ||
            latest.timestamp.isAfter(_lastTimestamp!)) {
          _lastTimestamp = latest.timestamp;
          _queue.add(latest);
          _showNextIfNeeded();
        }
      }
    });

    return widget.child;
  }

  void _showNextIfNeeded() {
    if (_isShowing || _queue.isEmpty || !mounted) return;

    final item = _queue.removeFirst();
    _isShowing = true;

    // Show the bubble
    AppFeedbackBubble.show(
      context,
      message: item.title.toUpperCase(),
      icon: _getIcon(item.type),
      color: _getColor(item.type),
      isLeft: item.type == FeedbackType.error,
      onDismissed: () {
        if (mounted) {
          setState(() {
            _isShowing = false;
            _showNextIfNeeded();
          });
        }
      },
    );
  }

  IconData _getIcon(FeedbackType type) {
    switch (type) {
      case FeedbackType.success:
        return Icons.check_circle_rounded;
      case FeedbackType.error:
        return Icons.error_rounded;
      case FeedbackType.warning:
        return Icons.warning_rounded;
      case FeedbackType.info:
        return Icons.info_rounded;
    }
  }

  Color _getColor(FeedbackType type) {
    switch (type) {
      case FeedbackType.success:
        return AppColors.success;
      case FeedbackType.error:
        return AppColors.error;
      case FeedbackType.warning:
        return AppColors.warning;
      case FeedbackType.info:
        return Theme.of(context).colorScheme.primary;
    }
  }
}
