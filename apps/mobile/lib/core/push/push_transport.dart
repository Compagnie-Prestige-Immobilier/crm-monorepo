import 'dart:async';

import 'push_message.dart';

/// Frontière avec Firebase.
///
/// **C'est la couture qui rend la fonctionnalité testable sans projet
/// Firebase.** Rien au-dessus de cette interface ne connaît `RemoteMessage`,
/// `FirebaseMessaging` ni la moindre notion de plugin : la navigation par lien
/// profond, la boîte de réception, le compteur de non-lues et le démarrage à
/// froid s'exercent tous contre [FakePushTransport] dans `flutter test`.
///
/// Aucun import `package:flutter/` ici, ni dans aucun fichier de
/// `lib/core/push/` — même discipline que `lib/core/sync/`, et pour la même
/// raison : ce code doit rester exécutable hors d'un arbre de widgets.
abstract interface class PushTransport {
  /// Prépare le transport. Renvoie `false` si Firebase n'est pas configuré —
  /// ce qui est l'état NORMAL tant qu'aucun projet n'existe, pas une panne.
  Future<bool> initialize();

  /// Le transport est-il utilisable ?
  bool get isAvailable;

  /// Demande l'autorisation d'afficher des notifications (Android 13+).
  Future<PushPermission> requestPermission();

  /// Autorisation actuelle, sans rien demander.
  Future<PushPermission> currentPermission();

  /// Jeton d'enregistrement de cet appareil, ou `null` si indisponible.
  Future<String?> token();

  /// Jetons renouvelés par FCM. Un jeton change tout seul ; ne pas l'écouter
  /// condamne l'appareil à ne plus rien recevoir, en silence.
  Stream<String> get tokenRefreshes;

  /// Messages reçus pendant que l'application est au premier plan.
  Stream<PushMessage> get foregroundMessages;

  /// Messages ouverts par un tap alors que l'application était en arrière-plan.
  Stream<PushMessage> get openedMessages;

  /// Message qui a lancé l'application depuis un état TERMINÉ.
  ///
  /// À ne consommer qu'une fois : c'est le point de départ de la navigation à
  /// froid, et le rejouer produirait une redirection surprise à chaque reprise.
  Future<PushMessage?> initialMessage();

  /// Supprime le jeton local, à la déconnexion.
  Future<void> deleteToken();
}

/// État d'autorisation, réduit à ce dont l'interface a besoin.
enum PushPermission {
  /// Jamais demandée. C'est l'état au premier lancement.
  notRequested,
  granted,

  /// Refusée. **L'application doit rester entièrement utilisable** : les
  /// notifications sont un confort, la prospection hors ligne est le métier.
  denied,

  /// Aucun transport : pas de projet Firebase, ou initialisation échouée.
  unavailable,
}

/// Transport inerte.
///
/// Utilisé quand `Firebase.initializeApp()` échoue — typiquement parce que
/// `google-services.json` est absent, ce qui est le cas tant que le projet
/// Firebase n'a pas été créé. L'application démarre, la boîte de réception se
/// remplit depuis l'API, et seul le push temps réel manque.
class NullPushTransport implements PushTransport {
  const NullPushTransport();

  @override
  Future<bool> initialize() async => false;

  @override
  bool get isAvailable => false;

  @override
  Future<PushPermission> requestPermission() async => PushPermission.unavailable;

  @override
  Future<PushPermission> currentPermission() async => PushPermission.unavailable;

  @override
  Future<String?> token() async => null;

  @override
  Stream<String> get tokenRefreshes => const Stream<String>.empty();

  @override
  Stream<PushMessage> get foregroundMessages => const Stream<PushMessage>.empty();

  @override
  Stream<PushMessage> get openedMessages => const Stream<PushMessage>.empty();

  @override
  Future<PushMessage?> initialMessage() async => null;

  @override
  Future<void> deleteToken() async {}
}

/// Doublure pilotable, pour les tests.
///
/// Vit dans `lib/` et non dans `test/` pour la même raison que `StubApi` : les
/// tests d'intégration comme les exécutions de démonstration en ont besoin, et
/// un fichier de `test/` n'est pas importable depuis `lib/`.
class FakePushTransport implements PushTransport {
  FakePushTransport({
    this.available = true,
    this.permission = PushPermission.notRequested,
    this.registrationToken = 'fake-token',
    PushMessage? launchMessage,
  }) : _launchMessage = launchMessage;

  bool available;
  PushPermission permission;
  String? registrationToken;
  PushMessage? _launchMessage;

  bool initialized = false;
  bool permissionRequested = false;
  bool tokenDeleted = false;
  bool initialMessageConsumed = false;

  final StreamController<PushMessage> _foreground = StreamController<PushMessage>.broadcast();
  final StreamController<PushMessage> _opened = StreamController<PushMessage>.broadcast();
  final StreamController<String> _tokens = StreamController<String>.broadcast();

  /// Simule un message reçu au premier plan.
  void emitForeground(PushMessage message) => _foreground.add(message);

  /// Simule un tap sur une notification, application en arrière-plan.
  void emitOpened(PushMessage message) => _opened.add(message);

  void emitTokenRefresh(String token) => _tokens.add(token);

  Future<void> dispose() async {
    await _foreground.close();
    await _opened.close();
    await _tokens.close();
  }

  @override
  Future<bool> initialize() async {
    initialized = true;
    return available;
  }

  @override
  bool get isAvailable => available;

  @override
  Future<PushPermission> requestPermission() async {
    permissionRequested = true;
    if (!available) return PushPermission.unavailable;
    if (permission == PushPermission.notRequested) permission = PushPermission.granted;
    return permission;
  }

  @override
  Future<PushPermission> currentPermission() async =>
      available ? permission : PushPermission.unavailable;

  @override
  Future<String?> token() async => available ? registrationToken : null;

  @override
  Stream<String> get tokenRefreshes => _tokens.stream;

  @override
  Stream<PushMessage> get foregroundMessages => _foreground.stream;

  @override
  Stream<PushMessage> get openedMessages => _opened.stream;

  @override
  Future<PushMessage?> initialMessage() async {
    initialMessageConsumed = true;
    final PushMessage? message = _launchMessage;
    // Consommé UNE fois : c'est le contrat du vrai transport, et un test qui
    // en dépendrait autrement passerait ici et échouerait en production.
    _launchMessage = null;
    return message;
  }

  @override
  Future<void> deleteToken() async {
    tokenDeleted = true;
    registrationToken = null;
  }
}
