library;

import 'package:crm_api_client/crm_api_client.dart';

class AuthTokens {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
    required this.userId,
    required this.fullName,
    this.role,
    this.email,
    this.departementId,
  });

  final String accessToken;
  final String refreshToken;
  final DateTime expiresAt;
  final String userId;
  final String fullName;

  final String? role;

  final String? email;

  final String? departementId;
}

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

  final String nextCursor;
  final bool hasMore;
  final DateTime serverTime;
}

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

  final String phase2Status;

  final String? enrollmentMethod;

  final int rev;
  final DateTime updatedAt;
}

class Phase2DirectoryPage {
  const Phase2DirectoryPage({
    required this.entries,
    required this.nextCursor,
    required this.hasMore,
    required this.serverTime,
  });

  final List<Phase2DirectoryEntry> entries;

  final String nextCursor;

  final bool hasMore;

  final DateTime serverTime;
}

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

  final String? ownedByCommercialId;
  final String? ownedByCommercialName;
}

enum FailureKind {
  retryable,

  unreachable,

  throttled,

  idempotencyInProgress,

  terminal,

  sessionExpired,
}

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

  final Duration? retryAfter;

  bool get retryable =>
      kind == FailureKind.retryable ||
      kind == FailureKind.unreachable ||
      kind == FailureKind.throttled ||
      kind == FailureKind.idempotencyInProgress;

  bool get isUnreachable => kind == FailureKind.unreachable;

  @override
  String toString() => 'ApiException($code, status: $statusCode, $message)';
}

abstract interface class ApiPort {
  Future<AuthTokens> login({
    required String identifier,
    required String password,
  });

  Future<AuthTokens> refresh({required String refreshToken});

  Future<void> logout({required String refreshToken});

  Future<PullPage> pull({String? cursor, int limit, required int payloadVersion});

  Future<PushResult> push({
    required String batchId,
    required int payloadVersion,
    required List<SyncOperationDto> operations,
  });

  Future<void> uploadCallRecording({
    required String attemptId,
    required String path,
  });

  Future<Phase2DirectoryPage> pullPhase2Directory({String? cursor, int limit});

  /// Le référentiel entier, filtré par le serveur sur `minPayloadVersion` : sans
  /// pagination ni curseur, il tient en quelques dizaines de lignes.
  Future<List<CallOutcomeReasonDto>> pullCallOutcomeReasons({
    required int payloadVersion,
  });

  Future<RepresentantLookup> lookupRepresentantByPhone(String phone);
}
