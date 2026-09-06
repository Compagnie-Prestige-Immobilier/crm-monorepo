import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/push/push_inbox_store.dart';
import '../../../core/push/push_message.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/local/database.dart';
import '../notification_inbox.dart';
import '../notifications_controller.dart';
import '../../../ui/async_value_x.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';

/// Le serveur nomme des écrans du PANNEAU dans ses rappels. Ceux qui ont un
/// pendant ici y mènent ; les autres ne sont pas un lien, plutôt qu'une
/// « Page introuvable ».
String? destinationMobile(BuildContext context, String? route) {
  if (!PushMessage.isSafeRoute(route)) return null;
  final String cible = switch (Uri.parse(route!).path) {
    '/phase2/callbacks' => Routes.rappels,
    _ => route,
  };
  final GoRouter? router = GoRouter.maybeOf(context);
  if (router == null) return cible;
  try {
    return router.configuration.findMatch(Uri.parse(cible)).isError
        ? null
        : cible;
  } on Object {
    return null;
  }
}

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
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

  Future<void> _markAllRead(BuildContext context, int unread) async {
    // Lu AVANT la feuille : la confirmation démonte le contexte, et un `ref`
    // relu ensuite porterait sur un widget mort.
    final PushInboxStore store = ref.read(pushInboxStoreProvider);
    final bool? ok = await cpiConfirm(
      context,
      title: 'Tout marquer comme lu ?',
      message: unread == 1
          ? 'Cette annonce sera marquée lue.'
          : '$unread annonces seront marquées lues.',
      confirmLabel: 'Marquer',
    );
    if (ok != true) return;
    try {
      await store.markAllRead();
    } on Object {
      if (!mounted || !context.mounted) return;
      cpiToast(context, 'Marquage impossible. Réessayez.', persistent: true);
      return;
    }
    if (!mounted || !context.mounted) return;
    cpiToast(
      context,
      unread == 1 ? 'Annonce marquée lue.' : '$unread annonces marquées lues.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final AsyncValue<List<StoredNotification>> notifications = ref.watch(
      notificationsProvider,
    );
    final int unread = ref.watch(unreadNotificationsProvider).value ?? 0;

    return CpiPopScope(
      child: CpiScaffold(
        title: 'Annonces',
        leading: const CpiBackButton(),
        banner: ValueListenableBuilder<InboxStatus>(
          valueListenable: ref.watch(notificationInboxProvider).status,
          builder: (BuildContext context, InboxStatus status, Widget? _) =>
              status.state != InboxSync.offline
              ? const SizedBox.shrink()
              : const Padding(
                  padding: EdgeInsets.fromLTRB(
                    CpiSpacing.md,
                    0,
                    CpiSpacing.md,
                    CpiSpacing.xs,
                  ),
                  child: CpiStatusBand(
                    text: 'Hors ligne. Voici les annonces déjà reçues.',
                    tone: CpiTone.warning,
                  ),
                ),
        ),
        footer: unread == 0
            ? null
            // `Builder` : la confirmation et le message bref ont besoin d'un
            // contexte SOUS le `FToaster` que pose `CpiScaffold`.
            : Builder(
                builder: (BuildContext context) => CpiActionBar(
                  child: MergeSemantics(
                    child: Semantics(
                      container: true,
                      button: true,
                      onTap: () => unawaited(_markAllRead(context, unread)),
                      child: CpiButton(
                        'Tout marquer comme lu',
                        icon: PhosphorIconsRegular.checks,
                        onPressed: () =>
                            unawaited(_markAllRead(context, unread)),
                      ),
                    ),
                  ),
                ),
              ),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            if (unread > 0)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  CpiSpacing.md,
                  0,
                  CpiSpacing.md,
                  CpiSpacing.xs,
                ),
                child: Text(
                  '$unread non lue${unread > 1 ? 's' : ''}',
                  style: theme.textTheme.titleSmall,
                ),
              ),
            Expanded(
              child: notifications.whenEchecDAbord(
                loading: () => const Center(child: FCircularProgress()),
                error: (Object _, StackTrace _) => CpiErrorState(
                  message: 'Les annonces n\'ont pas pu être lues.',
                  onRetry: () => ref.invalidate(notificationsProvider),
                ),
                data: (List<StoredNotification> rows) => RefreshIndicator(
                  color: theme.colorScheme.primary,
                  onRefresh: () async {
                    final NotificationInbox boite = ref.read(
                      notificationInboxProvider,
                    );
                    await HapticFeedback.selectionClick();
                    await boite.refresh(force: true);
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
                                child: CpiEmptyState(
                                  icon: PhosphorIconsDuotone.megaphone,
                                  title: 'Aucune annonce',
                                  message: 'Rien pour l\'instant.',
                                  action: CpiButton(
                                    'Actualiser',
                                    icon: PhosphorIconsRegular.arrowClockwise,
                                    expand: false,
                                    onPressed: _refresh,
                                  ),
                                ),
                              ),
                            );
                          },
                        )
                      : Padding(
                          padding: const EdgeInsets.fromLTRB(
                            CpiSpacing.md,
                            0,
                            CpiSpacing.md,
                            CpiSpacing.md,
                          ),
                          child: FTileGroup.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            count: rows.length,
                            tileBuilder: (BuildContext context, int index) =>
                                _NotificationTile(data: rows[index]),
                          ),
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

class _NotificationTile extends ConsumerStatefulWidget {
  const _NotificationTile({required this.data});

  final StoredNotification data;

  @override
  ConsumerState<_NotificationTile> createState() => _NotificationTileState();
}

class _NotificationTileState extends ConsumerState<_NotificationTile> {
  bool _opening = false;

  /// Un seul verrou pour les deux dégâts du double tap : la lecture remontée
  /// deux fois au serveur, et la destination empilée deux fois.
  Future<void> _open() async {
    if (_opening) return;
    _opening = true;
    // Lue après l'`await`, la remontée serveur mourait sur un `ref` démonté et
    // le `on Object` avalait l'erreur : l'annonce restait non lue au siège.
    final PushInboxStore local = ref.read(pushInboxStoreProvider);
    final NotificationInbox distant = ref.read(notificationInboxProvider);
    try {
      await local.markRead(widget.data.id);
      distant.markRead(widget.data.id).ignore();
    } on Object {
      _opening = false;
      if (!mounted) return;
      cpiToast(context, 'Marquage impossible. Réessayez.', persistent: true);
      return;
    }
    if (!mounted) {
      _opening = false;
      return;
    }
    final String? cible = destinationMobile(context, widget.data.route);
    if (cible != null) await context.push<Object?>(cible);
    _opening = false;
  }

  @override
  Widget build(BuildContext context) {
    final StoredNotification data = widget.data;
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final bool isUnread = data.readAt == null;
    final bool hasRoute = destinationMobile(context, data.route) != null;

    return FTile(
      title: Text(data.title),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(data.body),
          const SizedBox(height: CpiSpacing.xxs),
          // `Wrap` et non `Row` : au plus grand texte, date et affordance
          // « Ouvrir » ne tiennent plus côte à côte dans la largeur restante.
          Wrap(
            spacing: CpiSpacing.xs,
            runSpacing: CpiSpacing.xxs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: <Widget>[
              Text(
                _formatDate(data.createdAt),
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              if (hasRoute)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Icon(
                      PhosphorIconsRegular.arrowRight,
                      size: CpiIconSize.xxs,
                      color: cpi.accentText,
                    ),
                    const SizedBox(width: CpiSpacing.xxs),
                    Text(
                      'Ouvrir',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: cpi.accentText,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
      details: isUnread ? const CpiTag('Non lue', tone: CpiTone.warning) : null,
      onPress: () => unawaited(_open()),
    );
  }
}

String _formatDate(DateTime value) {
  final DateTime local = value.toLocal();
  final DateTime now = DateTime.now();
  final bool sameDay =
      local.year == now.year &&
      local.month == now.month &&
      local.day == now.day;
  return sameDay
      ? "Aujourd'hui ${DateFormat.Hm('fr').format(local)}"
      : DateFormat('d MMM, HH:mm', 'fr').format(local);
}
