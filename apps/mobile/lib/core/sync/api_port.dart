/// Frontière réseau du moteur de synchronisation — **Dart pur**.
///
/// Le port est typé avec les modèles du client généré depuis
/// `apps/api/openapi.json`, et non avec des `Map<String, dynamic>` maison. C'est
/// délibéré : si le contrat serveur change, la compilation doit casser ici,
/// pendant le build, plutôt qu'à l'exécution dans un village sans réseau.
///
/// Aucun `import 'package:flutter/...'` ici, ni dans aucun fichier de
/// `lib/core/sync/` : ce code tourne aussi dans l'isolat WorkManager, qui n'a ni
/// arbre de widgets, ni conteneur Riverpod, ni plugins enregistrés.
library;

import 'package:crm_api_client/crm_api_client.dart';

/// Couple de jetons renvoyé par l'authentification.
class AuthTokens {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
    required this.userId,
    required this.fullName,
    this.role,
    this.email,
  });

  final String accessToken;
  final String refreshToken;
  final DateTime expiresAt;
  final String userId;
  final String fullName;

  /// Rôle serveur, brut (`COMMERCIAL`, `ADMIN`…). Il sert à afficher à
  /// l'utilisateur **qui il est** ; c'est l'identifiant technique qui, lui, n'a
  /// rien à faire sur un écran de réglages.
  final String? role;

  final String? email;
}

/// Réponse d'un envoi de lot.
class PushResult {
  const PushResult({
    required this.batchId,
    required this.results,
    required this.serverTime,
  });

  final String batchId;
  final List<SyncOperationResultDto> results;
  final DateTime serverTime;
}

/// Une page de pull delta, paginée en keyset sur `(updatedAt, id)`.
class PullPage {
  const PullPage({
    required this.changes,
    required this.deletions,
    required this.nextCursor,
    required this.hasMore,
    required this.serverTime,
  });

  final SyncChangesDto changes;
  final List<SyncDeletionDto> deletions;

  /// Curseur opaque `{t, id}` — jamais un horodatage nu (ADR 0001 §6). Il se
  /// renvoie tel quel, on ne l'interprète pas côté client.
  final String nextCursor;
  final bool hasMore;
  final DateTime serverTime;
}

/// Une entrée de l'annuaire de phase 2 — **six champs, jamais un de plus**.
///
/// L'annuaire est répliqué hors ligne sur le téléphone personnel de chaque
/// commercial et couvre tout le portefeuille. Le nom, la banque et le syndicat
/// en sont absents **délibérément** : le programme de travail est un PDF
/// imprimé qui ne porte que des numéros, et une perte d'appareil ne doit pas
/// pouvoir faire fuiter une base nominative. Ce n'est pas une préférence, c'est
/// la frontière de confidentialité du dispositif — on ne demande pas plus au
/// serveur, et on ne stocke pas plus localement.
class Phase2DirectoryEntry {
  const Phase2DirectoryEntry({
    required this.prospectId,
    required this.phoneE164,
    required this.phase2Status,
    required this.enrollmentMethod,
    required this.rev,
    required this.updatedAt,
  });

  final String prospectId;
  final String phoneE164;

  /// `PENDING` · `METHOD_OBTAINED` · `REFUSED` · `WRONG_NUMBER`.
  final String phase2Status;

  /// Non nulle si et seulement si [phase2Status] vaut `METHOD_OBTAINED`.
  final String? enrollmentMethod;

  final int rev;
  final DateTime updatedAt;
}

/// Une page de l'annuaire, paginée en keyset sur `(updatedAt, prospectId)`.
class Phase2DirectoryPage {
  const Phase2DirectoryPage({
    required this.entries,
    required this.nextCursor,
    required this.hasMore,
    required this.serverTime,
  });

  final List<Phase2DirectoryEntry> entries;

  /// Curseur opaque. Sur une page vide, le serveur renvoie celui qu'on lui a
  /// donné : on le réécrit tel quel, on ne l'interprète jamais.
  final String nextCursor;

  /// `hasMore` vaut `entries.length == limit` côté serveur : une dernière page
  /// pleine annonce donc encore du travail, et coûte un aller-retour à vide.
  /// C'est le serveur qui a raison, pas notre intuition — on boucle jusqu'à
  /// `false`.
  final bool hasMore;

  final DateTime serverTime;
}

/// Ce qu'on sait d'un numéro de représentant déjà connu du serveur.
class RepresentantLookup {
  const RepresentantLookup({
    required this.found,
    required this.phoneE164,
    this.representant,
    this.ownedByCommercialId,
    this.ownedByCommercialName,
  });

  final bool found;
  final String phoneE164;
  final RepresentantDto? representant;

  /// Attribution. Elle détermine la commission : une fiche appartenant à un
  /// autre commercial ne se fusionne JAMAIS automatiquement.
  final String? ownedByCommercialId;
  final String? ownedByCommercialName;
}

/// Comment le moteur doit traiter un échec de transport.
///
/// Une énumération et pas un simple booléen `retryable` : « réessayer dans 2 s
/// sans compter la tentative » et « réessayer dans 4 minutes en comptant la
/// tentative » sont deux comportements différents, et les confondre fait passer
/// une opération parfaitement saine en `dead` au bout de huit collisions
/// d'idempotence.
enum FailureKind {
  /// Coupure, DNS, délai dépassé, 5xx, 408, 425. Back-off normal, tentative
  /// comptée.
  retryable,

  /// 429. Le serveur dit *quand* revenir : on l'écoute, plutôt que d'appliquer
  /// notre back-off qui serait soit trop court (on se refait limiter) soit trop
  /// long (on attend pour rien).
  throttled,

  /// 409 `IDEMPOTENCY_IN_PROGRESS`. Un autre appel traite déjà exactement ce
  /// lot ; il va aboutir. On repasse dans 2 s **sans compter la tentative** :
  /// ce n'est pas un échec, c'est une file d'attente.
  idempotencyInProgress,

  /// 400 / 403 / 422. Réessayer produira le même refus jusqu'à la fin des
  /// temps. L'opération part en `failed` et remonte dans « À corriger ».
  terminal,

  /// Le renouvellement de jeton a échoué. Rien ne repartira tant que
  /// l'utilisateur ne s'est pas reconnecté.
  sessionExpired,
}

/// Erreur réseau/protocole normalisée. Le moteur décide à partir de [kind] : il
/// n'a pas à connaître les codes HTTP.
class ApiException implements Exception {
  const ApiException(
    this.code, {
    this.message,
    this.statusCode,
    this.kind = FailureKind.retryable,
    this.retryAfter,
  });

  final String code;
  final String? message;
  final int? statusCode;
  final FailureKind kind;

  /// Renseigné pour [FailureKind.throttled], depuis l'en-tête `Retry-After`.
  final Duration? retryAfter;

  bool get retryable =>
      kind == FailureKind.retryable ||
      kind == FailureKind.throttled ||
      kind == FailureKind.idempotencyInProgress;

  @override
  String toString() => 'ApiException($code, status: $statusCode, $message)';
}

/// Le port. Une implémentation = un transport.
abstract interface class ApiPort {
  Future<AuthTokens> login({required String identifier, required String password});

  Future<AuthTokens> refresh({required String refreshToken});

  Future<void> logout({required String refreshToken});

  /// Une seule page pour toutes les collections : le serveur renvoie un curseur
  /// unique couvrant référentiels et métier. Un curseur par table divergerait au
  /// premier pull interrompu.
  Future<PullPage> pull({String? cursor, int limit});

  /// Pousse un lot. [batchId] part **à l'identique** dans l'en-tête
  /// `Idempotency-Key` et dans `clientBatchId` — le serveur refuse en 422 si les
  /// deux diffèrent.
  Future<PushResult> push({
    required String batchId,
    required int payloadVersion,
    required List<SyncOperationDto> operations,
  });

  /// Pousse un lot dont les opérations sont du **JSON brut**.
  ///
  /// TODO(generated-client): supprimer cette méthode et repasser par [push] dès
  /// que `apps/api/openapi.json` aura été régénéré en client Dart. Aujourd'hui
  /// le client généré est en retard sur le serveur : `SyncEntity` ne connaît que
  /// `representant` et `prospect`, et `SyncEntityDataDto` n'a ni `prospectId`,
  /// ni `outcome`, ni `method`, ni `comment`. Il est généré avec
  /// `disallowUnrecognizedKeys: false`, donc `SyncEntityDataDto.fromJson`
  /// **laisse tomber ces champs en silence** au lieu de lever : passer une
  /// tentative d'appel par [push] produirait un lot que le serveur refuse en
  /// `CALL_ATTEMPT_INCOMPLETE`, sans le moindre indice côté client. Un chemin
  /// brut, explicitement nommé et isolé, est le moindre mal — et la bascule sera
  /// mécanique.
  Future<PushResult> pushRaw({
    required String batchId,
    required int payloadVersion,
    required List<Map<String, Object?>> operations,
  });

  /// Une page de l'annuaire de phase 2.
  ///
  /// TODO(generated-client): remplacer par `Phase2Api.getDirectory` quand le
  /// client généré connaîtra `/api/v1/phase2/directory`.
  Future<Phase2DirectoryPage> pullPhase2Directory({String? cursor, int limit});

  /// Recherche d'un représentant par téléphone, avant saisie et après un 409.
  /// Répond même si la fiche appartient à un autre commercial, en le nommant.
  Future<RepresentantLookup> lookupRepresentantByPhone(String phone);
}
