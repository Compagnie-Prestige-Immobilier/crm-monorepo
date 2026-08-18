import 'dart:developer' as developer;

import 'package:crm_api_client/crm_api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/push/push_inbox_store.dart';
import '../../core/push/push_message.dart';
import '../../data/local/database.dart';
import 'notifications_controller.dart';

enum InboxSync {
  never,

  ok,

  offline,
}

@immutable
class InboxStatus {
  const InboxStatus({required this.state, this.lastSuccessAt});

  const InboxStatus.never() : this(state: InboxSync.never);

  final InboxSync state;

  final DateTime? lastSuccessAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is InboxStatus &&
          other.state == state &&
          other.lastSuccessAt == lastSuccessAt;

  @override
  int get hashCode => Object.hash(state, lastSuccessAt);
}

class NotificationInbox {
  NotificationInbox({required NotificationsApi api, required PushInboxStore store})
    : _api = api,
      _store = store;

  static const Duration minimumInterval = Duration(minutes: 2);

  final NotificationsApi _api;
  final PushInboxStore _store;

  DateTime? _lastRefreshAt;
  Future<int>? _inFlight;

  final ValueNotifier<InboxStatus> _status = ValueNotifier<InboxStatus>(
    const InboxStatus.never(),
  );

  ValueListenable<InboxStatus> get status => _status;

  Future<int> refresh({bool force = false, int pageSize = 50}) {
    final Future<int>? running = _inFlight;
    if (running != null) return running;

    final DateTime? last = _lastRefreshAt;
    if (!force && last != null && DateTime.now().difference(last) < minimumInterval) {
      return Future<int>.value(0);
    }

    final Future<int> task = _refresh(pageSize).whenComplete(() {
      _lastRefreshAt = DateTime.now();
      _inFlight = null;
    });
    _inFlight = task;
    return task;
  }

  Future<int> _refresh(int pageSize) async {
    try {
      final Response<InboxDto> response = await _api.listMyNotifications(
        pageSize: pageSize,
      );
      final InboxDto? body = response.data;
      if (body == null) return 0;

      final List<PushMessage> messages = <PushMessage>[];
      final Map<String, DateTime?> readStates = <String, DateTime?>{};

      for (final InboxItemDto item in body.items) {
        if (item.notificationId.isEmpty) continue;
        final String? route = item.route;
        messages.add(
          PushMessage(
            id: item.notificationId,
            title: item.title,
            body: item.body,
            category: item.category.name,
            route: PushMessage.isSafeRoute(route) ? route : null,
            sentAt: item.createdAt.toUtc(),
          ),
        );
        readStates[item.notificationId] = item.readAt?.toUtc();
      }

      final List<String> unreported = await _unreportedReads(readStates);

      await _store.upsertAll(messages, readStates: readStates);
      _status.value = InboxStatus(state: InboxSync.ok, lastSuccessAt: DateTime.now());

      for (final String id in unreported) {
        await markRead(id);
      }
      return messages.length;
    } on Object catch (error) {
      developer.log(
        'Rafraîchissement de la boîte de réception échoué : $error',
        name: 'cpi.notifications',
      );
      _status.value = InboxStatus(
        state: InboxSync.offline,
        lastSuccessAt: _status.value.lastSuccessAt,
      );
      return 0;
    }
  }

  Future<List<String>> _unreportedReads(Map<String, DateTime?> serverReads) async {
    final List<String> pending = <String>[];
    for (final MapEntry<String, DateTime?> entry in serverReads.entries) {
      if (entry.value != null) continue;
      final StoredNotification? local = await _store.byId(entry.key);
      if (local?.readAt != null) pending.add(entry.key);
    }
    return pending;
  }

  Future<void> markRead(String notificationId) async {
    try {
      await _api.markNotificationRead(id: notificationId);
    } on Object catch (error) {
      developer.log('Remontée de lecture échouée : $error', name: 'cpi.notifications');
    }
  }

  void dispose() => _status.dispose();
}

final Provider<NotificationInbox> notificationInboxProvider = Provider<NotificationInbox>(
  (Ref ref) {
    final NotificationInbox inbox = NotificationInbox(
      api: ref.watch(apiClientProvider).client.getNotificationsApi(),
      store: ref.watch(pushInboxStoreProvider),
    );
    ref.onDispose(inbox.dispose);
    return inbox;
  },
);
