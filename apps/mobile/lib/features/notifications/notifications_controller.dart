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


final Provider<PushTransport> pushTransportProvider = Provider<PushTransport>((Ref ref) {
  return const NullPushTransport();
});

final Provider<PushInboxStore> pushInboxStoreProvider = Provider<PushInboxStore>((
  Ref ref,
) {
  return PushInboxStore(ref.watch(appDatabaseProvider));
});

final StreamProvider<List<StoredNotification>> notificationsProvider =
    StreamProvider<List<StoredNotification>>((Ref ref) {
      return ref.watch(pushInboxStoreProvider).watchAll();
    });

final StreamProvider<int> unreadNotificationsProvider = StreamProvider<int>((Ref ref) {
  return ref.watch(pushInboxStoreProvider).watchUnreadCount();
});


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

  void offer(PushMessage message) {
    final String? route = message.route;
    if (!PushMessage.isSafeRoute(route)) return;
    state = PendingPushRoute(route: route!, notificationId: message.id);
  }

  void offerRoute(String route, {String? notificationId}) {
    if (!PushMessage.isSafeRoute(route)) return;
    state = PendingPushRoute(route: route, notificationId: notificationId);
  }

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

    _foreground = transport.foregroundMessages.listen((PushMessage message) {
      unawaited(inbox.upsert(message));
    });

    _opened = transport.openedMessages.listen((PushMessage message) {
      unawaited(inbox.upsert(message));
      ref.read(pendingPushRouteProvider.notifier).offer(message);
    });

    _lifecycle = AppLifecycleListener(
      onResume: () => unawaited(ref.read(notificationInboxProvider).refresh(force: true)),
    );

    await _consumeLaunchMessage(transport, inbox);
    unawaited(ref.read(notificationInboxProvider).refresh(force: true));
    state = true;
  }

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
