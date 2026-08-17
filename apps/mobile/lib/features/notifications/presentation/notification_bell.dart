import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../notifications_controller.dart';

class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final int unread = ref.watch(unreadNotificationsProvider).value ?? 0;
    final bool hasUnread = unread > 0;

    return Semantics(
      button: true,
      label: hasUnread
          ? '$unread notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}'
          : 'Notifications',
      child: InkWell(
        onTap: () => context.push(Routes.notifications),
        borderRadius: CpiRadius.brFull,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: CpiSpacing.sm,
              vertical: CpiSpacing.xs,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(
                  hasUnread ? PhosphorIconsFill.bell : PhosphorIconsRegular.bell,
                  size: 20,
                  color: hasUnread
                      ? context.cpi.accentOnDark
                      : theme.colorScheme.onPrimary,
                ),
                if (hasUnread) ...<Widget>[
                  const SizedBox(width: CpiSpacing.xxs + 2),
                  Text(
                    unread > 99 ? '99+' : '$unread',
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: context.cpi.accentOnDark,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
