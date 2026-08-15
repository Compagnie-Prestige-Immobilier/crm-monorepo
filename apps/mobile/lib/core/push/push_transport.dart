import 'dart:async';

import 'push_message.dart';

/// Canal d'arrivée des annonces.
///
/// ═══ POURQUOI CETTE INTERFACE SURVIT À FIREBASE ═══
///
/// Firebase a été abandonné : il impose un compte Google que CPI n'ouvre pas.
/// Le canal réel est désormais l'inbox applicative, tirée depuis
/// `/notifications/mine` (voir `features/notifications/notification_inbox.dart`).
///
/// L'abstraction reste pour deux raisons, et aucune n'est de la spéculation :
///
///  1. **La navigation par lien profond est la partie fragile**, et elle est
///     entièrement exerçable contre [FakePushTransport] : un message qui lance
///     l'application depuis un état terminé, un message ouvert alors qu'elle
///     était en arrière-plan, une route d'hameçonnage refusée. Supprimer la
///     couture supprimerait aussi les tests qui gardent ce chemin.
///  2. Le jour où un transport sans compte Google est branché (WebSocket,
///     Unified Push, notification locale programmée), **un seul fichier change**.
///
/// Ce qui a disparu avec Firebase : le jeton d'appareil, son renouvellement, et
/// toute la notion d'autorisation système. Plus rien n'affiche de notification
/// Android, donc plus rien n'a à en demander la permission ; un écran qui
/// l'aurait quand même proposée aurait promis ce qu'il ne peut pas tenir.
///
/// Aucun import `package:flutter/` ici, ni dans aucun fichier de
/// `lib/core/push/` (même discipline que `lib/core/sync/`, et pour la même
/// raison) : ce code doit rester exécutable hors d'un arbre de widgets.
abstract interface class PushTransport {
  /// Messages reçus pendant que l'application est au premier plan.
  Stream<PushMessage> get foregroundMessages;

  /// Messages ouverts par un tap alors que l'application était en arrière-plan.
  Stream<PushMessage> get openedMessages;

  /// Message qui a lancé l'application depuis un état TERMINÉ.
  ///
  /// À ne consommer qu'une fois : c'est le point de départ de la navigation à
  /// froid, et le rejouer produirait une redirection surprise à chaque reprise.
  Future<PushMessage?> initialMessage();
}

/// Transport inerte : le transport réel de l'application aujourd'hui.
///
/// Rien ne pousse plus rien en temps réel. L'application démarre, la boîte de
/// réception se remplit depuis l'API à l'ouverture de l'écran, au retour au
/// premier plan et après chaque cycle de synchronisation. C'est un état
/// NORMAL, pas une panne, et l'interface ne l'annonce donc nulle part.
class NullPushTransport implements PushTransport {
  const NullPushTransport();

  @override
  Stream<PushMessage> get foregroundMessages => const Stream<PushMessage>.empty();

  @override
  Stream<PushMessage> get openedMessages => const Stream<PushMessage>.empty();

  @override
  Future<PushMessage?> initialMessage() async => null;
}

/// Doublure pilotable, pour les tests.
///
/// Vit dans `lib/` et non dans `test/` pour la même raison que `StubApi` : les
/// tests d'intégration comme les exécutions de démonstration en ont besoin, et
/// un fichier de `test/` n'est pas importable depuis `lib/`.
class FakePushTransport implements PushTransport {
  FakePushTransport({PushMessage? launchMessage}) : _launchMessage = launchMessage;

  PushMessage? _launchMessage;

  bool initialMessageConsumed = false;

  final StreamController<PushMessage> _foreground =
      StreamController<PushMessage>.broadcast();
  final StreamController<PushMessage> _opened = StreamController<PushMessage>.broadcast();

  /// Simule un message reçu au premier plan.
  void emitForeground(PushMessage message) => _foreground.add(message);

  /// Simule un tap sur une notification, application en arrière-plan.
  void emitOpened(PushMessage message) => _opened.add(message);

  Future<void> dispose() async {
    await _foreground.close();
    await _opened.close();
  }

  @override
  Stream<PushMessage> get foregroundMessages => _foreground.stream;

  @override
  Stream<PushMessage> get openedMessages => _opened.stream;

  @override
  Future<PushMessage?> initialMessage() async {
    initialMessageConsumed = true;
    final PushMessage? message = _launchMessage;
    // Consommé UNE fois : c'est le contrat du transport, et un test qui en
    // dépendrait autrement passerait ici et échouerait en production.
    _launchMessage = null;
    return message;
  }
}
