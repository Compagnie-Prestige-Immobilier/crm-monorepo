import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/push/push_message.dart';
import '../../../core/push/push_transport.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/local/database.dart';
import '../notifications_controller.dart';

/// Centre de notifications.
///
/// ═══ L'AUTORISATION SE DEMANDE ICI, ET NULLE PART AILLEURS ═══
///
/// Android 13 exige `POST_NOTIFICATIONS` à l'exécution. La demander au premier
/// lancement — avant que l'utilisateur ait la moindre idée de ce que CPI GO
/// pourrait lui envoyer — la fait refuser par réflexe. Et un refus n'est pas
/// reposé : Android ne rouvre plus la boîte de dialogue, la seule issue devient
/// les réglages système, et personne n'y va.
///
/// Elle est donc demandée à la première ouverture de CET écran, c'est-à-dire au
/// moment où l'intention est explicite. L'écran explique d'abord ce qu'il va
/// envoyer, puis propose.
///
/// **Un refus ne bloque rien.** La liste reste lisible, elle se remplit depuis
/// la base locale, et le reste de l'application est intact — les notifications
/// sont un confort, la prospection hors ligne est le métier.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    // Après le premier cadre : lire l'autorisation touche un canal de
    // plateforme, et le faire pendant `initState` bloquerait la construction.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaitedRefresh();
    });
  }

  void unawaitedRefresh() {
    ref.read(pushPermissionProvider.notifier).refresh();
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final AsyncValue<List<StoredNotification>> notifications = ref.watch(
      notificationsProvider,
    );
    final PushPermission permission = ref.watch(pushPermissionProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
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
          _PermissionBanner(permission: permission),
          Expanded(
            child: notifications.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (Object error, StackTrace stack) => _Empty(
                icon: PhosphorIconsDuotone.warningCircle,
                title: 'Liste indisponible',
                message:
                    'Les notifications enregistrées sur cet appareil n’ont pas pu être lues.',
                color: cpi.syncFailed,
              ),
              data: (List<StoredNotification> rows) {
                if (rows.isEmpty) {
                  return _Empty(
                    icon: PhosphorIconsDuotone.bellSlash,
                    title: 'Aucune notification',
                    message:
                        'Les annonces et les rappels envoyés par le siège apparaîtront ici, même '
                        'sans réseau.',
                    color: theme.colorScheme.outline,
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: CpiSpacing.xs),
                  itemCount: rows.length,
                  separatorBuilder: (BuildContext context, int index) => const Divider(
                    height: 1,
                    indent: CpiSpacing.md,
                    endIndent: CpiSpacing.md,
                  ),
                  itemBuilder: (BuildContext context, int index) =>
                      _NotificationTile(data: rows[index]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Bandeau d'autorisation.
///
/// Trois états, trois messages différents, et aucun ne culpabilise :
///
///  · jamais demandée → on explique et on propose ;
///  · refusée         → on dit ce qui est perdu et on ouvre les réglages ;
///  · indisponible    → on le dit franchement plutôt que de faire semblant.
class _PermissionBanner extends ConsumerWidget {
  const _PermissionBanner({required this.permission});

  final PushPermission permission;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final CpiColors cpi = context.cpi;
    final ThemeData theme = Theme.of(context);

    if (permission == PushPermission.granted) return const SizedBox.shrink();

    final (String title, String message, String action) = switch (permission) {
      PushPermission.notRequested => (
        'Recevoir les annonces du siège',
        'Rappels de synchronisation, appels en attente et annonces. Rien de commercial, rien la '
            'nuit.',
        'Autoriser',
      ),
      PushPermission.denied => (
        'Notifications désactivées',
        'Vous ne serez pas prévenu des rappels ni des annonces. La liste ci-dessous continue de '
            'se remplir à chaque ouverture de l’application.',
        'Ouvrir les réglages',
      ),
      PushPermission.unavailable => (
        'Notifications indisponibles sur cet appareil',
        'La messagerie push n’est pas configurée. Les annonces restent consultables ici, à '
            'chaque ouverture.',
        '',
      ),
      PushPermission.granted => ('', '', ''),
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.sm,
        CpiSpacing.md,
        CpiSpacing.xxs,
      ),
      padding: const EdgeInsets.all(CpiSpacing.sm),
      decoration: BoxDecoration(
        color: cpi.accentSurface,
        borderRadius: CpiRadius.brMd,
        border: Border.all(color: cpi.accentBorder.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(PhosphorIconsRegular.bell, size: 20, color: cpi.accentText),
              const SizedBox(width: CpiSpacing.xs),
              Expanded(
                child: Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(color: cpi.accentText),
                ),
              ),
            ],
          ),
          const SizedBox(height: CpiSpacing.xxs),
          Text(message, style: theme.textTheme.bodySmall),
          if (action.isNotEmpty) ...<Widget>[
            const SizedBox(height: CpiSpacing.xs),
            Align(
              alignment: Alignment.centerRight,
              child: ConstrainedBox(
                // 48 dp minimum : l'application sert debout, au soleil, parfois
                // à une main.
                constraints: const BoxConstraints(minHeight: 48),
                child: FilledButton(
                  onPressed: () async {
                    if (permission == PushPermission.notRequested) {
                      await ref.read(pushPermissionProvider.notifier).request();
                      return;
                    }
                    // Android ne repose jamais une demande refusée : la seule
                    // issue est la page de l'application dans les réglages.
                    await const AndroidIntent(
                      action: 'android.settings.APP_NOTIFICATION_SETTINGS',
                      arguments: <String, dynamic>{
                        'android.provider.extra.APP_PACKAGE': 'sn.cpi.go',
                      },
                    ).launch();
                  },
                  child: Text(action),
                ),
              ),
            ),
          ],
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
        // La lecture est enregistrée AVANT la navigation : partir d'abord
        // laisserait une notification lue marquée non lue si l'écran de
        // destination remplaçait celui-ci pendant l'écriture.
        await ref.read(pushInboxStoreProvider).markRead(data.id);
        if (!context.mounted) return;
        if (hasRoute) context.go(data.route!);
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
              // Pastille de non-lu. Elle porte aussi une étiquette de
              // sémantique : la couleur seule ne peut pas être la seule
              // porteuse d'information (WCAG 1.4.1).
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

/// Date lisible. `intl` avec la locale française, comme partout ailleurs.
String _formatDate(DateTime value) {
  final DateTime local = value.toLocal();
  final DateTime now = DateTime.now();
  final bool sameDay =
      local.year == now.year && local.month == now.month && local.day == now.day;
  return sameDay
      ? "Aujourd'hui ${DateFormat.Hm('fr').format(local)}"
      : DateFormat('d MMM, HH:mm', 'fr').format(local);
}
