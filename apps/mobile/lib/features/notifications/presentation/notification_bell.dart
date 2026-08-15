import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../notifications_controller.dart';

/// Cloche de l'AppBar, avec le compteur de non-lues.
///
/// Calquée sur `SyncBadge` : même géométrie, même cible tactile, même règle de
/// couleur. Sur le bordeaux de l'AppBar, l'or lisible est `accentOnDark`
/// (#FFC65A, 8,71:1) ; l'or de surface #C8921A y serait illisible
/// (docs/design.md §2.3).
///
/// Le compteur est plafonné à « 99+ » : au-delà, le chiffre exact n'apprend
/// plus rien et déforme la barre.
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
        // `push` et non `go` : `go` REMPLACE la pile, et c'est exactement ce
        // qui rendait le centre d'annonces sans issue : plus rien à dépiler,
        // donc flèche inerte et geste système qui sort de l'application. Voir
        // `core/router/back_navigation.dart`.
        onTap: () => context.push(Routes.notifications),
        borderRadius: CpiRadius.brFull,
        child: ConstrainedBox(
          // 48 dp : l'application sert debout, au soleil, parfois à une main.
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
