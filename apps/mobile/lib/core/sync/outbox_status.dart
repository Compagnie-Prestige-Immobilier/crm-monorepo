/// Vocabulaire de statut de l'outbox : **Dart pur**.
///
/// Les cinq valeurs sont contraintes par un `CHECK` dans `schema.drift` et lues
/// par les deux vues SQL qui dérivent `sync_status`. Elles ne sont donc pas
/// négociables sans migration.
///
/// Correspondance avec le vocabulaire de l'ADR, qui parle d'« inflight » et de
/// « dead » :
///
/// | ADR        | Ici       | Pourquoi                                       |
/// |------------|-----------|------------------------------------------------|
/// | `pending`  | `pending` | en file, éligible dès `nextAttemptAt`           |
/// | `inflight` | `syncing` | bail pris, requête en vol                       |
/// | `applied`  | `done`    | acquitté par le serveur                         |
/// | `conflict` | `conflict`| arbitrage utilisateur requis                    |
/// | `dead`     | `failed`  | terminal ; remonte dans « À corriger »          |
///
/// Un statut n'est jamais comparé par chaîne littérale ailleurs dans le code :
/// une faute de frappe dans `'sycning'` produirait une opération invisible du
/// sélecteur, donc jamais envoyée, sans la moindre erreur.
abstract final class OutboxStatus {
  static const String pending = 'pending';

  /// Bail pris, requête partie. Écrit **avant** l'appel réseau : un plantage en
  /// vol laisse ainsi un bail expirable, que le prochain cycle récupère.
  static const String syncing = 'syncing';

  static const String done = 'done';
  static const String conflict = 'conflict';
  static const String failed = 'failed';

  /// Les états qui comptent encore comme « en attente » pour l'utilisateur.
  static const List<String> open = <String>[pending, syncing, conflict, failed];

  /// Les états qui demandent une action humaine : l'écran « À corriger ».
  static const List<String> needsAttention = <String>[conflict, failed];
}

/// Codes d'erreur produits par le client lui-même (le serveur a les siens).
abstract final class ClientErrorCodes {
  /// Le payload stocké n'est plus décodable par le modèle courant. L'opération
  /// part en `failed` et devient visible : un échec contrôlé, jamais une
  /// exception non rattrapée dans un isolat de fond.
  static const String payloadSchemaMismatch = 'PAYLOAD_SCHEMA_MISMATCH';

  /// Le serveur n'a rien dit de cette opération. Ne devrait pas arriver ; si ça
  /// arrive, mieux vaut le voir que le deviner.
  static const String noResult = 'NO_RESULT';

  /// Huit tentatives épuisées.
  static const String attemptsExhausted = 'ATTEMPTS_EXHAUSTED';
}

/// Codes serveur dont le moteur tire une décision particulière.
abstract final class ServerErrorCodes {
  static const String representantPhoneConflict = 'REPRESENTANT_PHONE_CONFLICT';
  static const String prospectPhoneConflict = 'PROSPECT_PHONE_CONFLICT';
  static const String revConflict = 'REV_CONFLICT';
  static const String entityIdOwnedByAnotherUser = 'ENTITY_ID_OWNED_BY_ANOTHER_USER';
  static const String representantOwnedByAnotherUser =
      'REPRESENTANT_OWNED_BY_ANOTHER_USER';
  static const String representantNotFound = 'REPRESENTANT_NOT_FOUND';
  static const String parentRepresentantFailed = 'PARENT_REPRESENTANT_FAILED';
  static const String groupTransactionFailed = 'GROUP_TRANSACTION_FAILED';
  static const String idempotencyInProgress = 'IDEMPOTENCY_IN_PROGRESS';

  /// Le dossier a déjà été clos côté serveur (`phase2-sync.service.ts`).
  ///
  /// C'est un ARBITRAGE, pas un refus de saisie : deux commerciaux ont appelé le
  /// même numéro, ou le miroir optimiste local a devancé une décision serveur
  /// contraire. Classé en `failed`, il aurait envoyé le commercial corriger une
  /// saisie parfaitement valide.
  static const String phase2AlreadyCompleted = 'PHASE2_ALREADY_COMPLETED';
}
