// Legacy AppFeedback wrapper - for backwards compatibility only
// Use FeedbackService via Riverpod in new code
import '../services/feedback_service.dart';
import '../../init/app_bootstrapper.dart';

class AppFeedback {
  static void showSuccess({required String title, required String message}) {
    AppBootstrapper.container
        .read(feedbackServiceProvider.notifier)
        .showSuccess(title, message);
  }

  static void showToast({
    required String title,
    required String message,
    Duration duration = const Duration(seconds: 3),
  }) {
    AppBootstrapper.container
        .read(feedbackServiceProvider.notifier)
        .showSuccess(title, message);
  }

  static void showError(String message) {
    AppBootstrapper.container
        .read(feedbackServiceProvider.notifier)
        .showError(message);
  }

  static void showInfo(String message) {
    AppBootstrapper.container
        .read(feedbackServiceProvider.notifier)
        .showInfo(message);
  }

  static void showWarning(String message) {
    AppBootstrapper.container
        .read(feedbackServiceProvider.notifier)
        .showWarning(message);
  }
}
