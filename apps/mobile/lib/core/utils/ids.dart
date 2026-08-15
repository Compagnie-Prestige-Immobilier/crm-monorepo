import 'package:uuid/uuid.dart';

/// Fabrique d'identifiants : **Dart pur**, utilisable depuis l'isolat de fond.
///
/// UUID v7 et jamais v4 : la clé primaire côté Postgres est un UUID, et v7
/// préfixe l'identifiant d'un horodatage milliseconde, ce qui redonne la
/// localité B-tree qu'un v4 détruit (ADR 0001 §1).
///
/// Corollaire écrit ici pour qu'on ne l'oublie pas : **on ne trie jamais par
/// UUID**. La dérive d'horloge entre deux appareils rend l'ordre v7
/// inter-appareils dénué de sens. Localement on trie par `outbox.seq`, côté
/// serveur par `createdAt`.
abstract final class Ids {
  static const Uuid _uuid = Uuid();

  /// Identifiant d'entité, d'opération d'outbox, de lot ou de brouillon.
  static String newId() => _uuid.v7();

  /// Identifiant de requête HTTP (`X-Request-Id`). Même génération, autre
  /// usage : il ne sert qu'à recoller les journaux client et serveur.
  static String newRequestId() => _uuid.v7();
}
