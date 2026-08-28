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

  /// Le corps du lot n'a pas fini de partir. À la différence d'un réseau
  /// absent, l'envoi a bien été tenté : cette tentative se compte.
  static const String sendTimeout = 'SEND_TIMEOUT';

  /// Le lot a été refusé pour une AUTRE opération que celle-ci.
  static const String batchPeerRejected = 'BATCH_PEER_REJECTED';
}

abstract final class ServerErrorCodes {
  static const String representantPhoneConflict = 'REPRESENTANT_PHONE_CONFLICT';
  static const String prospectPhoneConflict = 'PROSPECT_PHONE_CONFLICT';
  static const String revConflict = 'REV_CONFLICT';
  static const String entityIdOwnedByAnotherUser =
      'ENTITY_ID_OWNED_BY_ANOTHER_USER';
  static const String representantOwnedByAnotherUser =
      'REPRESENTANT_OWNED_BY_ANOTHER_USER';
  static const String representantNotFound = 'REPRESENTANT_NOT_FOUND';
  static const String parentRepresentantFailed = 'PARENT_REPRESENTANT_FAILED';
  static const String groupTransactionFailed = 'GROUP_TRANSACTION_FAILED';
  static const String idempotencyInProgress = 'IDEMPOTENCY_IN_PROGRESS';

  static const String phase2AlreadyCompleted = 'PHASE2_ALREADY_COMPLETED';

  static const String appUpdateRequired = 'APP_UPDATE_REQUIRED';

  /// L'entrée choisie dans une liste de l'accueil n'existe plus côté serveur.
  /// Réessayer avec le même identifiant ne peut rien donner : c'est la liste
  /// du téléphone qui est périmée, et la saisie qui doit être rechoisie.
  static const String visiteReferentielUnavailable =
      'VISITE_REFERENTIEL_UNAVAILABLE';

  /// Refus PAR OPÉRATION des renseignements de conversion. Le serveur les
  /// rédige en anglais : « À corriger » les remplace par une phrase qui dit
  /// quoi retoucher, sans quoi le téléconseiller ne peut rien en faire.
  static const Map<String, String> phase2FieldErrors = <String, String>{
    'PHASE2_RENDEZ_VOUS_REQUIRED':
        'Cet appel s\'est conclu par une prise de rendez-vous, mais aucune '
        'date n\'a été enregistrée. Ressaisissez l\'appel avec sa date.',
    'PHASE2_RENDEZ_VOUS_NOT_ALLOWED':
        'Une date de rendez-vous n\'est acceptée que sur une prise de '
        'rendez-vous. Ressaisissez l\'appel avec la bonne méthode.',
    'PHASE2_RENDEZ_VOUS_INVALID':
        'La date du rendez-vous n\'est pas lisible. Ressaisissez l\'appel.',
    'PHASE2_RENDEZ_VOUS_PAST':
        'Le rendez-vous était déjà passé au moment de l\'appel. Ressaisissez '
        'l\'appel avec une date à venir.',
    'PHASE2_EMAIL_INVALID':
        'L\'adresse e-mail saisie pendant l\'appel n\'est pas valide.',
    'PHASE2_DUREE_ETABLISSEMENT_INVALID':
        'La durée dans l\'établissement doit aller de 0 à 600 mois.',
  };
}
