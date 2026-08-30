import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../theme/app_colors.dart';
import '../../services/feedback_service.dart';

/// The app-bar notification bell.
///
/// Renamed from `StatusBadge`, which was also the name of the status pill in
/// `indicators/status_badge.dart` — two unrelated widgets, one name, and which
/// one you got depended on the import. This is a notification affordance, not
/// a status label.
///
/// Only rendered when there is something to report.
class NotificationBellButton extends ConsumerWidget {
  const NotificationBellButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feedbackState = ref.watch(feedbackServiceProvider);
    final notifier = ref.read(feedbackServiceProvider.notifier);

    if (feedbackState.items.isEmpty) {
      return const SizedBox.shrink();
    }

    final hasUnread = feedbackState.hasUnread;

    return IconButton(
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          const Icon(Icons.notifications_outlined, size: 24),
          if (hasUnread)
            Positioned(
              right: 0,
              top: 0,
              child: Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppColors.error,
                  shape: BoxShape.circle,
                ),
              ),
            ),
        ],
      ),
      onPressed: () {
        if (hasUnread) {
          notifier.markAsRead();
        } else {
          notifier.clearAll();
        }
      },
      // The unread state is carried by an 8dp red dot and nothing else, so it
      // does not exist for a screen reader unless the label says it.
      tooltip: hasUnread
          ? 'Notifications — non lues'
          : 'Notifications — tout est lu',
    );
  }
}
