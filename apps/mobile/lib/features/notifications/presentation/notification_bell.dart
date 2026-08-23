import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../ui/widgets/appbar_badge.dart';
import '../notifications_controller.dart';

class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int unread = ref.watch(unreadNotificationsProvider).value ?? 0;
    final bool hasUnread = unread > 0;

    return CpiAppBarBadge(
      icon: hasUnread ? PhosphorIconsFill.bell : PhosphorIconsRegular.bell,
      label: hasUnread
          ? '$unread notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}'
          : 'Notifications',
      count: unread,
      emphasis: hasUnread,
      onTap: () => context.pushOnce(Routes.notifications),
    );
  }
}
