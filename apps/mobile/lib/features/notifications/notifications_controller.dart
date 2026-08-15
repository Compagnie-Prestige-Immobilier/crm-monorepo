import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/sync_coordinator.dart';
import '../../core/push/push_inbox_store.dart';
import '../../core/push/push_message.dart';
import '../../core/push/push_transport.dart';
import '../../data/local/database.dart';
import 'notification_inbox.dart';

/// Notifications : état d'interface et coordination.
///
/// Écrit à la main plutôt que généré par `riverpod_generator`, comme partout
/// dans ce dépôt : sur Flutter 3.41.7, `riverpod_generator` et `drift_dev`
/// n'ont aucun palier d'`analyzer` commun. Un `Notifier` manuel a exactement la
/// même sémantique.

/// Canal temps réel. Inerte aujourd'hui : Firebase a été abandonné et rien ne
/// pousse plus. Les tests injectent [FakePushTransport] pour exercer la
/// navigation par lien profond, qui reste le chemin fragile.
final Provider<PushTransport> pushTransportProvider = Provider<PushTransport>((Ref ref) {
  return const NullPushTransport();
});

final Provider<PushInboxStore> pushInboxStoreProvider = Provider<PushInboxStore>((
  Ref ref,
) {
  return PushInboxStore(ref.watch(appDatabaseProvider));
});

/// Liste locale, servie depuis SQLite : donc disponible hors ligne.
final StreamProvider<List<StoredNotification>> notificationsProvider =
    StreamProvider<List<StoredNotification>>((Ref ref) {
      return ref.watch(pushInboxStoreProvider).watchAll();
    });

/// Nombre de non-lues. Alimente la pastille de l'AppBar.
final StreamProvider<int> unreadNotificationsProvider = StreamProvider<int>((Ref ref) {
  return ref.watch(pushInboxStoreProvider).watchUnreadCount();
});

// ─────────────────────────────────────────────────────────────────────────────
// Route en attente : le cœur de la navigation à froid
// ─────────────────────────────────────────────────────────────────────────────

/// Route issue d'un tap sur une notification, en attente de navigation.
///
/// ═══ POURQUOI CE SAS EXISTE ═══
///
/// Au DÉMARRAGE À FROID, l'ordre des événements est le suivant :
///
///   1. l'utilisateur appuie sur la notification ;
///   2. le processus démarre, `getInitialMessage()` rend le message ;
///   3. le garde de route n'a PAS encore de verdict : la lecture du jeton de
///      renouvellement dans le stockage chiffré est asynchrone ;
///   4. le garde résout, et redirige vers `/` ou vers `/login`.
///
/// Naviguer à l'étape 2 est inutile : l'étape 4 écrase la destination. C'est
/// exactement ainsi qu'un lien profond « ne marche qu'une fois sur deux » :
/// il marche quand l'application était déjà ouverte, et se perd au démarrage à
/// froid, c'est-à-dire dans le cas qui compte.
///
/// La route est donc RETENUE ici et rejouée après la résolution du garde. Si
/// l'utilisateur n'est pas connecté, elle est conservée pendant la connexion et
/// rejouée ensuite : appuyer sur une notification, saisir son mot de passe et
/// atterrir sur l'accueil au lieu de la fiche annoncée serait un échec du même
/// ordre.
@immutable
class PendingPushRoute {
  const PendingPushRoute({required this.route, this.notificationId});

  final String route;
  final String? notificationId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PendingPushRoute &&
          other.route == route &&
          other.notificationId == notificationId;

  @override
  int get hashCode => Object.hash(route, notificationId);

  @override
  String toString() => 'PendingPushRoute($route)';
}

class PendingPushRouteController extends Notifier<PendingPushRoute?> {
  @override
  PendingPushRoute? build() => null;

  /// Retient une route à ouvrir. Une route non sûre est ignorée : c'est le
  /// dernier rempart avant `go_router`.
  void offer(PushMessage message) {
    final String? route = message.route;
    if (!PushMessage.isSafeRoute(route)) return;
    state = PendingPushRoute(route: route!, notificationId: message.id);
  }

  void offerRoute(String route, {String? notificationId}) {
    if (!PushMessage.isSafeRoute(route)) return;
    state = PendingPushRoute(route: route, notificationId: notificationId);
  }

  /// Prend la route et la retire. À appeler une seule fois, au moment de
  /// naviguer : la relire plus tard produirait une redirection surprise.
  PendingPushRoute? take() {
    final PendingPushRoute? pending = state;
    state = null;
    return pending;
  }

  void clear() => state = null;
}

final NotifierProvider<PendingPushRouteController, PendingPushRoute?>
pendingPushRouteProvider =
    NotifierProvider<PendingPushRouteController, PendingPushRoute?>(
      PendingPushRouteController.new,
    );

// ─────────────────────────────────────────────────────────────────────────────
// Coordination
// ─────────────────────────────────────────────────────────────────────────────

/// Tient la boîte de réception à jour, et branche le sas de lien profond.
///
/// ═══ CE COORDINATEUR EST CE QUI REND L'INBOX VRAIE ═══
///
/// Sans Firebase, personne ne pousse : une annonce composée au siège n'existe
/// pour le commercial que lorsque quelqu'un appelle `NotificationInbox.refresh`.
/// Ce fichier est le seul endroit qui le fait, et il le fait à trois moments,
/// choisis parce que ce sont les trois où l'utilisateur pourrait constater un
/// retard :
///
///  1. **à la construction**, c'est-à-dire à l'ouverture d'une session ;
///  2. **au retour au premier plan** : le téléphone a passé la nuit en poche ;
///  3. **après chaque cycle de synchronisation** : la liaison vient de prouver
///     qu'elle route, c'est le moment le moins cher pour tirer.
///
/// L'écran de notifications force en plus un rafraîchissement à son ouverture,
/// en appelant `NotificationInbox` directement : il n'a pas à instancier ce
/// coordinateur, qui est lié à la session et non à un écran.
///
/// Le plancher entre deux requêtes et la sérialisation des appels concurrents
/// vivent dans `NotificationInbox`, pas ici : les quatre déclencheurs les
/// partagent, et les dupliquer par appelant en laisserait un dehors.
///
/// Instancié une seule fois, depuis la racine de l'application et uniquement
/// quand une session est ouverte : même schéma que `SyncCoordinator`.
class NotificationsCoordinator extends Notifier<bool> {
  StreamSubscription<PushMessage>? _foreground;
  StreamSubscription<PushMessage>? _opened;
  AppLifecycleListener? _lifecycle;
  bool _startedUp = false;
  DateTime? _lastSyncSeenAt;

  @override
  bool build() {
    ref.onDispose(() {
      unawaited(_foreground?.cancel());
      unawaited(_opened?.cancel());
      _lifecycle?.dispose();
      _lifecycle = null;
    });

    // Après chaque cycle de synchronisation. On compare `lastRunAt` et non
    // `running` : ce dernier bascule deux fois par cycle, et tirer la boîte de
    // réception au DÉBUT d'un cycle la tirerait avant que le réseau ait prouvé
    // quoi que ce soit.
    ref.listen<SyncUiState>(syncCoordinatorProvider, (
      SyncUiState? previous,
      SyncUiState next,
    ) {
      final DateTime? ran = next.lastRunAt;
      if (ran == null || ran == _lastSyncSeenAt) return;
      _lastSyncSeenAt = ran;
      unawaited(ref.read(notificationInboxProvider).refresh());
    });

    unawaited(_start());
    return false;
  }

  Future<void> _start() async {
    final PushTransport transport = ref.read(pushTransportProvider);
    final PushInboxStore inbox = ref.read(pushInboxStoreProvider);

    // Un message reçu au premier plan n'affiche PAS de notification système sur
    // Android : c'est le comportement de la plateforme, pas un oubli. Il est
    // donc écrit en base, ce qui fait monter la pastille et apparaître la ligne
    // dans le centre : le seul retour possible sans interrompre la saisie en
    // cours.
    _foreground = transport.foregroundMessages.listen((PushMessage message) {
      unawaited(inbox.upsert(message));
    });

    // Tap alors que l'application était en arrière-plan : l'arbre existe, le
    // garde a déjà résolu. La route passe quand même par le sas, pour n'avoir
    // qu'UN seul chemin de navigation à raisonner et à tester.
    _opened = transport.openedMessages.listen((PushMessage message) {
      unawaited(inbox.upsert(message));
      ref.read(pendingPushRouteProvider.notifier).offer(message);
    });

    // Retour au premier plan : le téléphone a pu passer la nuit en poche, et
    // c'est l'instant exact où l'utilisateur regarde la pastille.
    _lifecycle = AppLifecycleListener(
      onResume: () => unawaited(ref.read(notificationInboxProvider).refresh(force: true)),
    );

    await _consumeLaunchMessage(transport, inbox);
    unawaited(ref.read(notificationInboxProvider).refresh(force: true));
    state = true;
  }

  /// Consomme le message qui a lancé l'application depuis un état TERMINÉ.
  ///
  /// Une seule fois par démarrage : `_startedUp` garde contre une double
  /// consommation si le coordinateur était reconstruit.
  Future<void> _consumeLaunchMessage(
    PushTransport transport,
    PushInboxStore inbox,
  ) async {
    if (_startedUp) return;
    _startedUp = true;

    final PushMessage? launch = await transport.initialMessage();
    if (launch == null) return;

    await inbox.upsert(launch);
    ref.read(pendingPushRouteProvider.notifier).offer(launch);
    developer.log(
      'Démarrage à froid depuis la notification ${launch.id} → ${launch.route}',
      name: 'cpi.notifications',
    );
  }
}

final NotifierProvider<NotificationsCoordinator, bool> notificationsCoordinatorProvider =
    NotifierProvider<NotificationsCoordinator, bool>(NotificationsCoordinator.new);
