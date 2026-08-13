import 'dart:async';
import 'dart:developer' as developer;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'push_message.dart';
import 'push_transport.dart';

/// Implémentation Firebase de [PushTransport].
///
/// **AUCUN import `package:flutter/` ici non plus.** Les types utilisés
/// (`FirebaseMessaging`, `RemoteMessage`, `NotificationSettings`) viennent des
/// paquets Firebase, qui n'exigent pas d'arbre de widgets pour être nommés.
///
/// TOUT EST DÉFENSIF, et c'est le point de conception central de ce fichier :
/// le projet Firebase n'existe pas encore. Sans `google-services.json`,
/// `Firebase.initializeApp()` lève. Cette exception est attrapée, journalisée
/// une fois, et le transport se déclare simplement indisponible. Laisser
/// remonter ferait échouer le démarrage de l'application entière à cause d'une
/// fonctionnalité de confort.
class FirebasePushTransport implements PushTransport {
  FirebasePushTransport();

  bool _available = false;
  FirebaseMessaging? _messaging;

  @override
  bool get isAvailable => _available;

  @override
  Future<bool> initialize() async {
    if (_available) return true;
    try {
      await Firebase.initializeApp();
      final FirebaseMessaging messaging = FirebaseMessaging.instance;
      _messaging = messaging;
      _available = true;
      developer.log('Transport push Firebase prêt.', name: 'cpi.push');
      return true;
    } on Object catch (error) {
      // Cas nominal tant qu'aucun projet Firebase n'est provisionné : le
      // fichier `google-services.json` est absent de `android/app/`.
      developer.log(
        'Firebase indisponible — les notifications ne seront pas reçues en '
        'temps réel. La boîte de réception continue de se remplir depuis '
        "l'API à chaque ouverture. Cause : $error",
        name: 'cpi.push',
      );
      _available = false;
      return false;
    }
  }

  @override
  Future<PushPermission> requestPermission() async {
    final FirebaseMessaging? messaging = _messaging;
    if (!_available || messaging == null) return PushPermission.unavailable;
    try {
      // Déclenche la boîte de dialogue POST_NOTIFICATIONS d'Android 13+.
      final NotificationSettings settings = await messaging.requestPermission();
      return _map(settings.authorizationStatus);
    } on Object catch (error) {
      developer.log(
        'Demande d’autorisation refusée par la plateforme : $error',
        name: 'cpi.push',
      );
      return PushPermission.unavailable;
    }
  }

  @override
  Future<PushPermission> currentPermission() async {
    final FirebaseMessaging? messaging = _messaging;
    if (!_available || messaging == null) return PushPermission.unavailable;
    try {
      final NotificationSettings settings = await messaging.getNotificationSettings();
      return _map(settings.authorizationStatus);
    } on Object {
      return PushPermission.unavailable;
    }
  }

  @override
  Future<String?> token() async {
    final FirebaseMessaging? messaging = _messaging;
    if (!_available || messaging == null) return null;
    try {
      return await messaging.getToken();
    } on Object catch (error) {
      developer.log('Jeton FCM indisponible : $error', name: 'cpi.push');
      return null;
    }
  }

  @override
  Stream<String> get tokenRefreshes {
    final FirebaseMessaging? messaging = _messaging;
    if (!_available || messaging == null) return const Stream<String>.empty();
    return messaging.onTokenRefresh;
  }

  @override
  Stream<PushMessage> get foregroundMessages {
    if (!_available) return const Stream<PushMessage>.empty();
    return FirebaseMessaging.onMessage
        .map(toPushMessage)
        .where(_isUsable)
        .cast<PushMessage>();
  }

  @override
  Stream<PushMessage> get openedMessages {
    if (!_available) return const Stream<PushMessage>.empty();
    return FirebaseMessaging.onMessageOpenedApp
        .map(toPushMessage)
        .where(_isUsable)
        .cast<PushMessage>();
  }

  @override
  Future<PushMessage?> initialMessage() async {
    final FirebaseMessaging? messaging = _messaging;
    if (!_available || messaging == null) return null;
    try {
      final RemoteMessage? message = await messaging.getInitialMessage();
      return message == null ? null : toPushMessage(message);
    } on Object catch (error) {
      developer.log('Message de lancement illisible : $error', name: 'cpi.push');
      return null;
    }
  }

  @override
  Future<void> deleteToken() async {
    final FirebaseMessaging? messaging = _messaging;
    if (!_available || messaging == null) return;
    try {
      await messaging.deleteToken();
    } on Object catch (error) {
      // Une suppression ratée ne doit pas retenir l'utilisateur sur l'appareil :
      // le serveur a déjà révoqué le jeton de son côté.
      developer.log('Suppression du jeton FCM échouée : $error', name: 'cpi.push');
    }
  }

  static bool _isUsable(PushMessage? message) => message != null;

  static PushPermission _map(AuthorizationStatus status) {
    switch (status) {
      case AuthorizationStatus.authorized:
      case AuthorizationStatus.provisional:
        return PushPermission.granted;
      case AuthorizationStatus.denied:
        return PushPermission.denied;
      case AuthorizationStatus.notDetermined:
        return PushPermission.notRequested;
    }
  }
}

/// Traduit un `RemoteMessage` en [PushMessage].
///
/// Publique et de premier niveau parce que le gestionnaire d'arrière-plan, qui
/// tourne dans un autre isolat, l'utilise aussi.
///
/// Le titre et le corps sont lus dans le bloc `notification` quand il existe —
/// c'est celui qu'Android affiche — et retombent sur `data` sinon, pour un
/// message purement applicatif.
PushMessage? toPushMessage(RemoteMessage message) {
  final Map<String, String> data = <String, String>{
    for (final MapEntry<String, dynamic> entry in message.data.entries)
      entry.key: '${entry.value}',
  };
  return PushMessage.fromData(
    data,
    notificationTitle: message.notification?.title,
    notificationBody: message.notification?.body,
    receivedAt: message.sentTime?.toUtc(),
  );
}
