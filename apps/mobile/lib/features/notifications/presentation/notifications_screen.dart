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

/// Centre d'annonces.
///
/// ═══ IL N'Y A PLUS RIEN À AUTORISER, DONC PLUS RIEN À DEMANDER ═══
///
/// Cet écran demandait `POST_NOTIFICATIONS` et affichait, quand le transport
/// manquait, « Notifications indisponibles sur cet appareil ». Firebase ayant
/// été abandonné, ce bandeau était devenu l'état permanent : l'application
/// annonçait sa propre panne à chaque ouverture, pour une fonctionnalité qui
/// marche. Il a disparu, ainsi que la demande d'autorisation et l'intent
/// `APP_NOTIFICATION_SETTINGS` qui codait en dur le nom du paquet.
///
/// Ce qui reste est la seule chose vraie : la liste, servie depuis SQLite (donc
/// hors ligne), et complétée par `/notifications/mine` à chaque ouverture et à
/// chaque retour au premier plan.
///
/// **Le retour arrière est explicite** (`CpiBackButton` + `CpiPopScope`) : c'est
/// une route de premier niveau, hors coque de navigation, et sans les deux la
/// flèche comme le geste système sortent de l'application. Voir
/// `core/router/back_navigation.dart`.
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
    // Après le premier cadre : le rapatriement touche le réseau, et le lancer
    // pendant `initState` retarderait la construction pour rien. La liste
    // locale, elle, s'affiche immédiatement.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _refresh();
    });
    // Le coordinateur de session rafraîchit déjà au retour au premier plan ;
    // l'écran le refait pour lui-même parce qu'il peut être ouvert alors que le
    // coordinateur n'existe pas (test, aperçu). Le plancher et le verrou de
    // `NotificationInbox` empêchent la requête en double.
    _lifecycle = AppLifecycleListener(onResume: _refresh);
  }

  @override
  void dispose() {
    _lifecycle?.dispose();
    super.dispose();
  }

  void _refresh() {
    // `force` : l'utilisateur a lui-même ouvert cet écran, il attend la liste
    // d'aujourd'hui, pas celle d'il y a deux minutes.
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
            // Bandeau d'actualité de la liste.
            //
            // « Aucune annonce » recouvrait TROIS situations différentes : la
            // boîte est vraiment vide, le rapatriement n'a pas encore eu lieu,
            // ou il a échoué. L'utilisateur en concluait que le siège n'avait
            // rien envoyé, et le message le lui confirmait.
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
                // Tirer pour rafraîchir enveloppe MAINTENANT les deux branches.
                // Il ne couvrait que la liste non vide : sur un état vide : et
                // c'est précisément l'état d'un premier lancement raté : il n'y
                // avait aucun moyen de redemander la liste, aucun geste, aucun
                // bouton.
                data: (List<StoredNotification> rows) => RefreshIndicator(
                  color: theme.colorScheme.primary,
                  onRefresh: () async {
                    await HapticFeedback.selectionClick();
                    await ref.read(notificationInboxProvider).refresh(force: true);
                  },
                  child: rows.isEmpty
                      ? ListView(
                          // `AlwaysScrollableScrollPhysics` : sans elle, une
                          // liste plus courte que l'écran ne défile pas, donc
                          // le geste « tirer » ne part jamais.
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: <Widget>[
                            SizedBox(
                              height: MediaQuery.sizeOf(context).height * 0.7,
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
                          ],
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

/// « Ce que vous voyez date d'avant. »
///
/// Le bandeau nomme la dernière synchronisation réussie : une liste vieille de
/// dix minutes et une liste jamais rapatriée n'appellent pas la même réaction.
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
        // La lecture est enregistrée AVANT la navigation : partir d'abord
        // laisserait une notification lue marquée non lue si l'écran de
        // destination remplaçait celui-ci pendant l'écriture.
        await ref.read(pushInboxStoreProvider).markRead(data.id);
        // Remontée au serveur, en tâche de fond : c'est ce qui permet au siège
        // de savoir qu'une annonce a été lue. Son échec ne change rien ici, la
        // lecture locale est déjà écrite.
        ref.read(notificationInboxProvider).markRead(data.id).ignore();
        if (!context.mounted) return;
        // `push` et non `go` : `go` REMPLACE toute la pile, si bien que l'écran
        // de destination n'avait plus rien derrière lui : le retour ne ramenait
        // jamais à la boîte de réception, et sur une route de premier niveau il
        // sortait de l'application. Voir `core/router/back_navigation.dart`.
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
