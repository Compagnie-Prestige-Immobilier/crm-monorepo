import 'package:flutter/services.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'feedback_service.g.dart';

enum FeedbackType { success, error, warning, info }

class FeedbackItem {
  final String title;
  final String message;
  final FeedbackType type;
  final DateTime timestamp;

  FeedbackItem({required this.title, required this.message, required this.type})
    : timestamp = DateTime.now();
}

class FeedbackState {
  final List<FeedbackItem> items;
  final bool hasUnread;

  const FeedbackState({this.items = const [], this.hasUnread = false});

  FeedbackState copyWith({List<FeedbackItem>? items, bool? hasUnread}) {
    return FeedbackState(
      items: items ?? this.items,
      hasUnread: hasUnread ?? this.hasUnread,
    );
  }
}

@riverpod
class FeedbackService extends _$FeedbackService {
  static const int maxItems = 10;

  @override
  FeedbackState build() {
    return const FeedbackState();
  }

  void showSuccess(String title, String message) {
    HapticFeedback.mediumImpact();
    _addFeedback(
      FeedbackItem(title: title, message: message, type: FeedbackType.success),
    );
  }

  void showError(String message) {
    HapticFeedback.heavyImpact();
    _addFeedback(
      FeedbackItem(title: 'Erreur', message: message, type: FeedbackType.error),
    );
  }

  void showWarning(String message) {
    HapticFeedback.lightImpact();
    _addFeedback(
      FeedbackItem(
        title: 'Attention',
        message: message,
        type: FeedbackType.warning,
      ),
    );
  }

  void showInfo(String message) {
    HapticFeedback.lightImpact();
    _addFeedback(
      FeedbackItem(title: 'Info', message: message, type: FeedbackType.info),
    );
  }

  void _addFeedback(FeedbackItem item) {
    final newItems = [item, ...state.items];
    // Keep only last 10 items
    if (newItems.length > maxItems) {
      newItems.removeRange(maxItems, newItems.length);
    }

    state = state.copyWith(items: newItems, hasUnread: true);
  }

  void markAsRead() {
    state = state.copyWith(hasUnread: false);
  }

  void clearAll() {
    state = const FeedbackState();
  }
}
