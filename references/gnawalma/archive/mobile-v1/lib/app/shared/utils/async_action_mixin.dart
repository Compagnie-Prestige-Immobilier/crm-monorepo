import '../services/feedback_service.dart';
import 'app_logger.dart';

mixin AsyncActionMixin {
  Future<T?> handleAsyncAction<T>(
    Future<T> Function() action, {
    String? successTitle,
    String? successMessage,
    String errorMessage = 'Une erreur est survenue',
    bool showToastOnSuccess = false,
    FeedbackService?
    feedbackNotifier, // Optional: if provided, uses the bubble system
  }) async {
    try {
      final result = await action();

      if (showToastOnSuccess && successMessage != null) {
        if (feedbackNotifier != null) {
          feedbackNotifier.showSuccess(
            successTitle ?? 'Succès',
            successMessage,
          );
        }
      }

      return result;
    } catch (e, stack) {
      AppLogger.e(errorMessage, e, stack);
      if (feedbackNotifier != null) {
        feedbackNotifier.showError(errorMessage);
      }
      return null;
    }
  }
}
