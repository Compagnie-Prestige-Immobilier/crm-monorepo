abstract final class OutboxStatus {
  static const String pending = 'pending';

  static const String syncing = 'syncing';

  static const String done = 'done';
  static const String conflict = 'conflict';
  static const String failed = 'failed';

  static const List<String> open = <String>[pending, syncing, conflict, failed];

  static const List<String> needsAttention = <String>[conflict, failed];
}

abstract final class ClientErrorCodes {
  static const String payloadSchemaMismatch = 'PAYLOAD_SCHEMA_MISMATCH';

  static const String noResult = 'NO_RESULT';

  static const String attemptsExhausted = 'ATTEMPTS_EXHAUSTED';
}

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

  static const String phase2AlreadyCompleted = 'PHASE2_ALREADY_COMPLETED';
}
