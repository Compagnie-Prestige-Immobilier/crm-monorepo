import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/push/push_message.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/local/database.dart';
import '../notification_inbox.dart';
import '../notifications_controller.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  AppLifecycleListener? _lifecycle;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _refresh();
    });
    _lifecycle = AppLifecycleListener(onResume: _refresh);
  }

  @override
  void dispose() {
    _lifecycle?.dispose();
    super.dispose();
  }

  void _refresh() {
    ref.read(notificationInboxProvider).refresh(force: true).ignore();
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final AsyncValue<List<StoredNotification>> notifications = ref.watch(
      notificationsProvider,
    );

    return CpiPopScope(
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Annonces'),
          leading: const CpiBackButton(),
          actions: <Widget>[
            IconButton(
              tooltip: 'Tout marquer comme lu',
              icon: const Icon(PhosphorIconsRegular.checks),
              onPressed: () {
                ref.read(pushInboxStoreProvider).markAllRead();
              },
            ),
            const SizedBox(width: CpiSpacing.xxs),
          ],
        ),
        body: Column(
          children: <Widget>[
            ValueListenableBuilder<InboxStatus>(
              valueListenable: ref.read(notificationInboxProvider).status,
              builder: (BuildContext context, InboxStatus status, Widget? _) {
                if (status.state != InboxSync.offline) {
                  return const SizedBox.shrink();
                }
                return _StaleStrip(lastSuccessAt: status.lastSuccessAt);
              },
            ),
            Expanded(
              child: notifications.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (Object error, StackTrace stack) => _Empty(
                  icon: PhosphorIconsDuotone.warningCircle,
                  title: 'Liste indisponible',
                  message:
                      'Les annonces enregistrées sur cet appareil n’ont pas pu '
                      'être lues.',
                  color: cpi.syncFailed,
                ),
                data: (List<StoredNotification> rows) => RefreshIndicator(
                  color: theme.colorScheme.primary,
                  onRefresh: () async {
                    await HapticFeedback.selectionClick();
                    await ref.read(notificationInboxProvider).refresh(force: true);
                  },
                  child: rows.isEmpty
                      ? LayoutBuilder(
                          builder: (BuildContext context, BoxConstraints box) {
                            return SingleChildScrollView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              child: ConstrainedBox(
                                constraints: BoxConstraints(
                                  minHeight: box.maxHeight,
                                ),
                                child: _Empty(
                                  icon: PhosphorIconsDuotone.megaphone,
                                  title: 'Aucune annonce',
                                  message:
                                      'Les annonces et les rappels envoyés par le '
                                      'siège apparaîtront ici, même sans réseau.\n'
                                      'Tirez vers le bas pour actualiser.',
                                  color: theme.colorScheme.outline,
                                ),
                              ),
                            );
                          },
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(
                            vertical: CpiSpacing.xs,
                          ),
                          physics: const AlwaysScrollableScrollPhysics(),
                          itemCount: rows.length,
                          separatorBuilder: (BuildContext context, int index) =>
                              const Divider(
                                height: 1,
                                indent: CpiSpacing.md,
                                endIndent: CpiSpacing.md,
                              ),
                          itemBuilder: (BuildContext context, int index) =>
                              _NotificationTile(data: rows[index]),
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StaleStrip extends StatelessWidget {
  const _StaleStrip({this.lastSuccessAt});

  final DateTime? lastSuccessAt;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    return Container(
      width: double.infinity,
      color: cpi.accentSurface,
      padding: const EdgeInsets.symmetric(
        horizontal: CpiSpacing.md,
        vertical: CpiSpacing.xs,
      ),
      child: Row(
        children: <Widget>[
          Icon(PhosphorIconsRegular.cloudSlash, size: 16, color: cpi.accentText),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Text(
              lastSuccessAt == null
                  ? 'Liste non actualisée, hors ligne. '
                        'Seules les annonces déjà reçues sont affichées.'
                  : 'Liste non actualisée, hors ligne. '
                        'Dernière mise à jour : ${_formatDate(lastSuccessAt!)}.',
              style: theme.textTheme.bodySmall?.copyWith(color: cpi.accentText),
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.data});

  final StoredNotification data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final bool isUnread = data.readAt == null;
    final bool hasRoute = PushMessage.isSafeRoute(data.route);

    return InkWell(
      onTap: () async {
        await ref.read(pushInboxStoreProvider).markRead(data.id);
        ref.read(notificationInboxProvider).markRead(data.id).ignore();
        if (!context.mounted) return;
        if (hasRoute) context.push(data.route!);
      },
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: CpiSpacing.md,
            vertical: CpiSpacing.sm,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Semantics(
                label: isUnread ? 'Non lue' : 'Lue',
                child: Container(
                  margin: const EdgeInsets.only(top: 6),
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isUnread ? theme.colorScheme.primary : Colors.transparent,
                  ),
                ),
              ),
              const SizedBox(width: CpiSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      data.title,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: isUnread ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(data.body, style: theme.textTheme.bodyMedium),
                    const SizedBox(height: CpiSpacing.xxs),
                    Row(
                      children: <Widget>[
                        Text(
                          _formatDate(data.createdAt),
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        if (hasRoute) ...<Widget>[
                          const SizedBox(width: CpiSpacing.xs),
                          Icon(
                            PhosphorIconsRegular.arrowRight,
                            size: 12,
                            color: cpi.accentText,
                          ),
                          const SizedBox(width: 2),
                          Text(
                            'Ouvrir',
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: cpi.accentText,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({
    required this.icon,
    required this.title,
    required this.message,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String message;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(CpiSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: 56, color: color),
            const SizedBox(height: CpiSpacing.md),
            Text(title, style: theme.textTheme.titleMedium, textAlign: TextAlign.center),
            const SizedBox(height: CpiSpacing.xs),
            Text(
              message,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

String _formatDate(DateTime value) {
  final DateTime local = value.toLocal();
  final DateTime now = DateTime.now();
  final bool sameDay =
      local.year == now.year && local.month == now.month && local.day == now.day;
  return sameDay
      ? "Aujourd'hui ${DateFormat.Hm('fr').format(local)}"
      : DateFormat('d MMM, HH:mm', 'fr').format(local);
}
