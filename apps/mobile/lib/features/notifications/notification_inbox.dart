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

/// Rapatriement de la boîte de réception depuis l'API.
///
/// ═══ CE SERVICE EST LE CANAL D'ANNONCES, PAS UN COMPLÉMENT ═══
///
/// Firebase est abandonné : plus rien ne pousse. Une annonce composée au siège
/// n'atteint le commercial que si quelqu'un appelle [refresh]. La promesse
/// « les annonces restent consultables ici » n'est donc tenue que par ses
/// appelants, et il y en a quatre : l'ouverture de l'écran, le retour au
/// premier plan, la fin de chaque cycle de synchronisation (les trois branchés
/// dans `NotificationsCoordinator`), et l'ouverture d'une session.
///
/// Tout passe par le client généré, jamais par `Dio` en direct : un
/// `dio.get('/api/v1/notifications/mine')` compilerait encore le jour où le
/// serveur renomme un champ, et échouerait à l'exécution chez un commercial,
/// sans personne pour lire l'erreur. Avec `NotificationsApi`, un changement de
/// contrat casse le build.
///
/// Aucune méthode ne lève : hors ligne, la liste locale reste servie, et c'est
/// tout l'intérêt de l'avoir persistée.
/// Ce que le dernier rapatriement a donné.
///
/// Sans cette information, l'écran affichait « Aucune annonce » dans trois
/// situations qui n'ont rien à voir : la boîte est vraiment vide, le
/// rapatriement n'a pas encore eu lieu, ou il a échoué. L'utilisateur en
/// concluait que le siège n'avait rien envoyé.
enum InboxSync {
  /// Aucun rapatriement n'a encore abouti sur cet appareil.
  never,

  /// La liste affichée est celle du serveur.
  ok,

  /// Le serveur n'a pas répondu : la liste est celle de la dernière fois.
  offline,
}

@immutable
class InboxStatus {
  const InboxStatus({required this.state, this.lastSuccessAt});

  const InboxStatus.never() : this(state: InboxSync.never);

  final InboxSync state;

  /// Dernier rapatriement RÉUSSI, tous appels confondus.
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

  /// Plancher entre deux rafraîchissements NON forcés.
  ///
  /// Le cycle de synchronisation tourne toutes les 60 s tant que l'application
  /// est visible. Sans plancher, ouvrir l'app et la poser sur une table
  /// produirait une requête par minute toute la journée, sur un forfait mobile.
  static const Duration minimumInterval = Duration(minutes: 2);

  final NotificationsApi _api;
  final PushInboxStore _store;

  DateTime? _lastRefreshAt;
  Future<int>? _inFlight;

  final ValueNotifier<InboxStatus> _status = ValueNotifier<InboxStatus>(
    const InboxStatus.never(),
  );

  /// Verdict du dernier rapatriement, observable par l'écran.
  ValueListenable<InboxStatus> get status => _status;

  /// Rapatrie la boîte de réception. Renvoie le nombre de lignes fusionnées.
  ///
  /// [force] ignore le plancher : quand l'utilisateur ouvre lui-même l'écran, il
  /// attend la liste d'aujourd'hui, pas celle d'il y a deux minutes.
  ///
  /// Les appels concurrents partagent la même requête : les déclencheurs
  /// peuvent tomber dans la même seconde (retour au premier plan, puis cycle de
  /// synchronisation, puis ouverture de l'écran) et trois requêtes écriraient
  /// trois fois les mêmes lignes.
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
            // Dernier rempart avant `go_router`. Le serveur applique déjà la
            // règle ; la refaire ici n'est pas redondant, le client ne doit
            // jamais dépendre du seul bon comportement de l'émetteur.
            route: PushMessage.isSafeRoute(route) ? route : null,
            sentAt: item.createdAt.toUtc(),
          ),
        );
        readStates[item.notificationId] = item.readAt?.toUtc();
      }

      // Les lectures faites hors ligne AVANT la fusion : le serveur ne les
      // connaît pas encore, et c'est le seul moment où on peut le savoir.
      final List<String> unreported = await _unreportedReads(readStates);

      await _store.upsertAll(messages, readStates: readStates);
      _status.value = InboxStatus(state: InboxSync.ok, lastSuccessAt: DateTime.now());

      // ═══ REJEU DES ACCUSÉS DE LECTURE ═══
      //
      // `markRead` était un « tire et oublie » sans rejeu : une annonce lue dans
      // un village sans réseau n'était JAMAIS remontée, et le siège la comptait
      // non lue indéfiniment.
      //
      // La file d'outbox n'est pas le bon endroit : elle ne transporte que des
      // opérations de `/sync/push`, dont le contrat ne connaît que
      // `representant` et `prospect` ; une opération `notification` y serait
      // sérialisée comme un prospect. La réconciliation ci-dessous est
      // équivalente et **s'auto-répare** : à chaque rapatriement, tout ce que le
      // serveur ignore encore repart, sans état supplémentaire à tenir à jour et
      // sans migration de schéma.
      for (final String id in unreported) {
        await markRead(id);
      }
      return messages.length;
    } on Object catch (error) {
      // Hors ligne : la liste locale reste servie.
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

  /// Les notifications lues ICI que le serveur croit encore non lues.
  Future<List<String>> _unreportedReads(Map<String, DateTime?> serverReads) async {
    final List<String> pending = <String>[];
    for (final MapEntry<String, DateTime?> entry in serverReads.entries) {
      if (entry.value != null) continue;
      final StoredNotification? local = await _store.byId(entry.key);
      if (local?.readAt != null) pending.add(entry.key);
    }
    return pending;
  }

  /// Remonte la lecture au serveur, pour que le siège la voie.
  ///
  /// La lecture LOCALE a déjà été écrite par l'appelant : cet appel est un
  /// bonus, et son échec ne doit rien changer à l'écran. Il n'est plus perdu
  /// pour autant : le rapatriement suivant le rejouera (voir [_refresh]).
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
    return NotificationInbox(
      api: ref.watch(apiClientProvider).client.getNotificationsApi(),
      store: ref.watch(pushInboxStoreProvider),
    );
  },
);
