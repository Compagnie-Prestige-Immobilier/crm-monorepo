import 'dart:developer' as developer;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/push/push_inbox_store.dart';
import '../../core/push/push_message.dart';
import '../../core/push/push_transport.dart';
import '../../data/local/database.dart';
import 'notifications_controller.dart';

/// Enregistrement de l'appareil auprès de l'API, et rapatriement de la boîte de
/// réception.
///
/// ── Chemin brut, en attendant le client généré ───────────────────────────────
///
/// TODO(generated-client) : tout ce fichier passe par `Dio` en direct, ce que
/// `DioApi` interdit partout ailleurs — un `dio.post('/api/v1/...')` compile
/// encore le jour où le serveur renomme un champ. C'est assumé le temps d'un
/// décalage de contrat : les routes `/devices/*` et `/notifications/mine`
/// viennent d'être ajoutées et `openapi.json` n'a pas encore été régénéré.
/// Le remplacement sera mécanique — quatre méthodes, aucun appelant à toucher.
///
/// En contrepartie, le décodage est **défensif** : une réponse inattendue
/// n'écrase rien et laisse la base locale intacte.
class PushRegistrationService {
  const PushRegistrationService({
    required Dio dio,
    required PushTransport transport,
    required PushInboxStore inbox,
    required AppDatabase database,
  }) : _dio = dio,
       _transport = transport,
       _inbox = inbox,
       _db = database;

  final Dio _dio;
  final PushTransport _transport;
  final PushInboxStore _inbox;
  final AppDatabase _db;

  static const String _registerPath = '/api/v1/devices/register';
  static const String _unregisterPath = '/api/v1/devices/unregister';
  static const String _inboxPath = '/api/v1/notifications/mine';
  static String _readPath(String id) => '/api/v1/notifications/$id/read';

  /// Enregistre le jeton de cet appareil.
  ///
  /// Appelée après la connexion, puis à chaque renouvellement de jeton par FCM.
  /// Ne lève JAMAIS : un enregistrement raté ne doit pas empêcher la connexion
  /// d'aboutir — l'utilisateur veut travailler, pas déboguer une notification.
  ///
  /// `pendingOps` accompagne l'enregistrement parce que le SERVEUR NE PEUT PAS
  /// LE DEVINER. C'est ce chiffre qui déclenche le rappel « saisies non
  /// synchronisées » ; sans lui, le serveur en serait réduit à déduire le retard
  /// d'une absence de synchronisation, ce qui confondrait un commercial en
  /// congé avec un téléphone qui retient une journée de prospection.
  Future<bool> register({String? appVersion}) async {
    final String? token = await _transport.token();
    if (token == null || token.isEmpty) return false;

    try {
      final int pending = await _pendingOps();
      await _dio.post<dynamic>(
        _registerPath,
        data: <String, Object?>{
          'token': token,
          'platform': 'ANDROID',
          'appVersion': ?appVersion,
          'pendingOps': pending,
        },
      );
      return true;
    } on Object catch (error) {
      developer.log('Enregistrement de l’appareil échoué : $error', name: 'cpi.push');
      return false;
    }
  }

  /// Révoque le jeton, à la déconnexion.
  ///
  /// Appelée AVANT l'effacement des jetons d'authentification : dans l'ordre
  /// inverse, la requête partirait sans session et l'appareil resterait
  /// enregistré au nom d'un utilisateur qui a quitté le téléphone.
  Future<void> unregister() async {
    final String? token = await _transport.token();
    if (token != null && token.isNotEmpty) {
      try {
        await _dio.post<dynamic>(
          _unregisterPath,
          data: <String, Object?>{'token': token},
        );
      } on Object catch (error) {
        // Une déconnexion serveur ratée ne doit pas retenir l'utilisateur sur
        // l'appareil : on efface localement quoi qu'il arrive.
        developer.log('Révocation du jeton échouée : $error', name: 'cpi.push');
      }
    }
    await _transport.deleteToken();
  }

  /// Rapatrie la boîte de réception depuis le serveur.
  ///
  /// C'est ce qui rend le centre de notifications utile SANS transport push :
  /// même sans projet Firebase, une notification composée par l'admin apparaît
  /// à la prochaine ouverture de l'application.
  Future<int> refreshInbox({int pageSize = 50}) async {
    try {
      final Response<dynamic> response = await _dio.get<dynamic>(
        _inboxPath,
        queryParameters: <String, Object?>{'pageSize': pageSize},
      );
      final Object? body = response.data;
      if (body is! Map<String, Object?>) return 0;
      final Object? items = body['items'];
      if (items is! List<Object?>) return 0;

      final List<PushMessage> messages = <PushMessage>[];
      final Map<String, DateTime?> readStates = <String, DateTime?>{};

      for (final Object? raw in items) {
        if (raw is! Map<String, Object?>) continue;
        final Object? id = raw['notificationId'];
        if (id is! String || id.isEmpty) continue;

        final Object? route = raw['route'];
        messages.add(
          PushMessage(
            id: id,
            title: '${raw['title'] ?? ''}',
            body: '${raw['body'] ?? ''}',
            category: '${raw['category'] ?? 'ANNONCE'}',
            route: route is String && PushMessage.isSafeRoute(route) ? route : null,
            sentAt: _parseDate(raw['createdAt']) ?? DateTime.now().toUtc(),
          ),
        );
        readStates[id] = _parseDate(raw['readAt']);
      }

      await _inbox.upsertAll(messages, readStates: readStates);
      return messages.length;
    } on Object catch (error) {
      // Hors ligne : la liste locale reste servie. C'est tout l'intérêt de
      // l'avoir persistée.
      developer.log(
        'Rafraîchissement de la boîte de réception échoué : $error',
        name: 'cpi.push',
      );
      return 0;
    }
  }

  /// Remonte la lecture au serveur, pour que le tableau de bord admin le sache.
  Future<void> pushRead(String notificationId) async {
    try {
      await _dio.post<dynamic>(_readPath(notificationId));
    } on Object catch (error) {
      developer.log('Remontée de lecture échouée : $error', name: 'cpi.push');
    }
  }

  /// Nombre d'opérations encore en file locale, et depuis quand.
  Future<int> _pendingOps() async {
    try {
      return await _db.countPendingOutbox().getSingle();
    } on Object {
      return 0;
    }
  }

  static DateTime? _parseDate(Object? raw) {
    if (raw is! String || raw.isEmpty) return null;
    return DateTime.tryParse(raw)?.toUtc();
  }
}

final Provider<PushRegistrationService> pushRegistrationProvider =
    Provider<PushRegistrationService>((Ref ref) {
      return PushRegistrationService(
        dio: ref.watch(apiClientProvider).dio,
        transport: ref.watch(pushTransportProvider),
        inbox: ref.watch(pushInboxStoreProvider),
        database: ref.watch(appDatabaseProvider),
      );
    });
