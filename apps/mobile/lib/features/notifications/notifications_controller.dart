import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/push/push_inbox_store.dart';
import '../../core/push/push_message.dart';
import '../../core/push/push_transport.dart';
import '../../data/local/database.dart';

/// Notifications — état d'interface et coordination.
///
/// Écrit à la main plutôt que généré par `riverpod_generator`, comme partout
/// dans ce dépôt : sur Flutter 3.41.7, `riverpod_generator` et `drift_dev`
/// n'ont aucun palier d'`analyzer` commun. Un `Notifier` manuel a exactement la
/// même sémantique.

/// Surchargé dans `main()`. Le transport réel est Firebase ; les tests
/// injectent [FakePushTransport], ce qui rend toute la fonctionnalité — y
/// compris la navigation à froid — exerçable sans projet Firebase.
final Provider<PushTransport> pushTransportProvider = Provider<PushTransport>((Ref ref) {
  return const NullPushTransport();
});

final Provider<PushInboxStore> pushInboxStoreProvider = Provider<PushInboxStore>((
  Ref ref,
) {
  return PushInboxStore(ref.watch(appDatabaseProvider));
});

/// Liste locale, servie depuis SQLite — donc disponible hors ligne.
final StreamProvider<List<StoredNotification>> notificationsProvider =
    StreamProvider<List<StoredNotification>>((Ref ref) {
      return ref.watch(pushInboxStoreProvider).watchAll();
    });

/// Nombre de non-lues. Alimente la pastille de l'AppBar.
final StreamProvider<int> unreadNotificationsProvider = StreamProvider<int>((Ref ref) {
  return ref.watch(pushInboxStoreProvider).watchUnreadCount();
});

// ─────────────────────────────────────────────────────────────────────────────
// Route en attente — le cœur de la navigation à froid
// ─────────────────────────────────────────────────────────────────────────────

/// Route issue d'un tap sur une notification, en attente de navigation.
///
/// ═══ POURQUOI CE SAS EXISTE ═══
///
/// Au DÉMARRAGE À FROID, l'ordre des événements est le suivant :
///
///   1. l'utilisateur appuie sur la notification ;
///   2. le processus démarre, `getInitialMessage()` rend le message ;
///   3. le garde de route n'a PAS encore de verdict — la lecture du jeton de
///      renouvellement dans le stockage chiffré est asynchrone ;
///   4. le garde résout, et redirige vers `/` ou vers `/login`.
///
/// Naviguer à l'étape 2 est inutile : l'étape 4 écrase la destination. C'est
/// exactement ainsi qu'un lien profond « ne marche qu'une fois sur deux » —
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
  /// naviguer — la relire plus tard produirait une redirection surprise.
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
// Autorisation
// ─────────────────────────────────────────────────────────────────────────────

/// État d'autorisation observé.
///
/// **L'autorisation est demandée EN CONTEXTE**, à la première ouverture du
/// centre de notifications — pas au premier lancement. Une demande au démarrage
/// arrive avant que l'utilisateur ait la moindre idée de ce que l'application
/// lui enverra ; elle est refusée par réflexe, et Android ne la repose plus
/// jamais. Le refus devient alors définitif pour une fonctionnalité qu'il n'a
/// pas eu l'occasion de vouloir.
class PushPermissionController extends Notifier<PushPermission> {
  @override
  PushPermission build() => PushPermission.notRequested;

  Future<void> refresh() async {
    state = await ref.read(pushTransportProvider).currentPermission();
  }

  /// Demande l'autorisation. Renvoie l'état obtenu.
  ///
  /// Un refus n'est PAS une erreur et ne bloque rien : l'application reste
  /// entièrement utilisable, la boîte de réception se remplit depuis l'API, et
  /// l'écran propose simplement d'ouvrir les réglages système.
  Future<PushPermission> request() async {
    final PushPermission result = await ref
        .read(pushTransportProvider)
        .requestPermission();
    state = result;
    return result;
  }
}

final NotifierProvider<PushPermissionController, PushPermission> pushPermissionProvider =
    NotifierProvider<PushPermissionController, PushPermission>(
      PushPermissionController.new,
    );

// ─────────────────────────────────────────────────────────────────────────────
// Coordination
// ─────────────────────────────────────────────────────────────────────────────

/// Branche les flux du transport sur la base locale et sur le sas de route.
///
/// Instancié une seule fois, depuis la racine de l'application et uniquement
/// quand une session est ouverte — même schéma que `SyncCoordinator`.
class PushCoordinator extends Notifier<bool> {
  StreamSubscription<PushMessage>? _foreground;
  StreamSubscription<PushMessage>? _opened;
  bool _startedUp = false;

  @override
  bool build() {
    ref.onDispose(() {
      unawaited(_foreground?.cancel());
      unawaited(_opened?.cancel());
    });
    unawaited(_start());
    return false;
  }

  Future<void> _start() async {
    final PushTransport transport = ref.read(pushTransportProvider);
    final PushInboxStore inbox = ref.read(pushInboxStoreProvider);

    // Un message reçu au premier plan n'affiche PAS de notification système sur
    // Android — c'est le comportement de la plateforme, pas un oubli. Il est
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

    await _consumeLaunchMessage(transport, inbox);
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
      name: 'cpi.push',
    );
  }
}

final NotifierProvider<PushCoordinator, bool> pushCoordinatorProvider =
    NotifierProvider<PushCoordinator, bool>(PushCoordinator.new);
