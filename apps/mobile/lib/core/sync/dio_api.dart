import 'package:crm_api_client/crm_api_client.dart';
import 'package:dio/dio.dart';

import '../network/api_environment.dart';
import '../network/auth_interceptor.dart';
import '../network/retry_after.dart' as retry_after;
import '../network/session_expired.dart';
import '../network/timeout_profile.dart';
import 'api_port.dart';
import 'outbox_status.dart';

class ResponseFormatException extends FormatException {
  ResponseFormatException(String message, this.contentType, [Object? source])
    : super(message, source);

  final String? contentType;

  bool get isJson => (contentType ?? '').toLowerCase().contains('json');
}

class DioApi implements ApiPort {
  DioApi(this._client);

  final CrmApiClient _client;

  AuthApi get _auth => _client.getAuthApi();
  SyncApi get _sync => _client.getSyncApi();
  Phase2Api get _phase2 => _client.getPhase2Api();
  RepresentantsApi get _representants => _client.getRepresentantsApi();
  CallOutcomeReasonsApi get _reasons => _client.getCallOutcomeReasonsApi();

  @override
  Future<AuthTokens> login({
    required String identifier,
    required String password,
  }) async {
    return _guard('login', () async {
      final Response<AuthTokensDto> response = await _auth.login(
        userAgent: ApiEnvironment.userAgent,
        loginDto: LoginDto(identifier: identifier, password: password),
        extra: <String, dynamic>{
          AuthInterceptor.noAuthFlag: true,
          ...TimeoutProfile.read.extra,
        },
      );
      return _toTokens(_body('login', response));
    });
  }

  @override
  Future<AuthTokens> refresh({required String refreshToken}) async {
    return _guard('refresh', () async {
      final Response<AuthTokensDto> response = await _auth.refreshSession(
        userAgent: ApiEnvironment.userAgent,
        refreshDto: RefreshDto(refreshToken: refreshToken),
        extra: <String, dynamic>{
          AuthInterceptor.noAuthFlag: true,
          ...TimeoutProfile.refresh.extra,
        },
      );
      return _toTokens(_body('refresh', response));
    });
  }

  @override
  Future<void> logout({required String refreshToken}) async {
    return _guard('logout', () async {
      await _auth.logout(
        refreshDto: RefreshDto(refreshToken: refreshToken),
        extra: TimeoutProfile.read.extra,
      );
    });
  }

  static AuthTokens _toTokens(AuthTokensDto dto) {
    return AuthTokens(
      accessToken: dto.accessToken,
      refreshToken: dto.refreshToken,
      expiresAt: DateTime.now().toUtc().add(
        Duration(seconds: dto.expiresIn.toInt()),
      ),
      userId: dto.user.id,
      fullName: dto.user.fullName,
      role: dto.user.role.value,
      email: dto.user.email,
      departementId: dto.user.departementId,
    );
  }

  @override
  Future<PullPage> pull({
    String? cursor,
    int limit = 200,
    required int payloadVersion,
  }) async {
    return _guard('pull', () async {
      final Response<SyncPullResponseDto> response = await _sync
          .pullSyncChanges(
            since: cursor,
            limit: limit,
            xCPIPayloadVersion: payloadVersion,
            extra: TimeoutProfile.read.extra,
          );
      final SyncPullResponseDto body = _body('pull', response);
      return PullPage(
        changes: body.changes,
        deletions: body.deletions,
        nextCursor: body.nextCursor,
        hasMore: body.hasMore,
        serverTime: body.serverTime,
      );
    });
  }

  @override
  Future<PushResult> push({
    required String batchId,
    required int payloadVersion,
    required List<SyncOperationDto> operations,
  }) async {
    return _guard('push', () async {
      final Response<SyncPushResponseDto> response = await _sync.pushSyncBatch(
        idempotencyKey: batchId,
        syncPushDto: SyncPushDto(
          clientBatchId: batchId,
          payloadVersion: payloadVersion,
          operations: operations,
        ),
        extra: TimeoutProfile.push.extra,
      );
      final SyncPushResponseDto body = _body('push', response);
      return PushResult(
        batchId: body.batchId,
        results: body.results,
        serverTime: body.serverTime,
      );
    });
  }

  @override
  Future<void> uploadCallRecording({
    required String attemptId,
    required String path,
  }) async {
    await _guard('callRecording', () async {
      await _phase2.uploadCallRecording(
        id: attemptId,
        file: await MultipartFile.fromFile(
          path,
          filename: '$attemptId.m4a',
          contentType: DioMediaType('audio', 'mp4'),
        ),
        extra: TimeoutProfile.upload.extra,
      );
    });
  }

  @override
  Future<Phase2DirectoryPage> pullPhase2Directory({
    String? cursor,
    int limit = 2000,
  }) async {
    return _guard('phase2Directory', () async {
      final Response<DirectoryPageDto> response = await _phase2
          .pullPhase2Directory(
            since: (cursor == null || cursor.isEmpty) ? null : cursor,
            limit: limit,
            extra: TimeoutProfile.read.extra,
          );
      final DirectoryPageDto body = _body('phase2Directory', response);
      return Phase2DirectoryPage(
        entries: <Phase2DirectoryEntry>[
          for (final DirectoryEntryDto entry in body.entries)
            _toDirectoryEntry(entry),
        ],
        nextCursor: body.nextCursor,
        hasMore: body.hasMore,
        serverTime: body.serverTime,
      );
    });
  }

  static Phase2DirectoryEntry _toDirectoryEntry(DirectoryEntryDto dto) {
    return Phase2DirectoryEntry(
      prospectId: dto.prospectId,
      phoneE164: dto.phoneE164,
      phase2Status: dto.phase2Status.value,
      enrollmentMethod: dto.enrollmentMethod?.value,
      rev: dto.rev.toInt(),
      updatedAt: dto.updatedAt,
    );
  }

  @override
  Future<List<CallOutcomeReasonDto>> pullCallOutcomeReasons({
    required int payloadVersion,
  }) async {
    return _guard('callOutcomeReasons', () async {
      final Response<CallOutcomeReasonListDto> response = await _reasons
          .listCallOutcomeReasons(
            payloadVersion: payloadVersion,
            extra: TimeoutProfile.read.extra,
          );
      return _body('callOutcomeReasons', response).items;
    });
  }

  @override
  Future<RepresentantLookup> lookupRepresentantByPhone(String phone) async {
    return _guard('lookup', () async {
      final Response<RepresentantLookupDto> response = await _representants
          .lookupRepresentantByPhone(
            phone: phone,
            extra: TimeoutProfile.read.extra,
          );
      final RepresentantLookupDto body = _body('lookup', response);
      return RepresentantLookup(
        found: body.found,
        phoneE164: body.phoneE164,
        representant: body.representant,
        ownedByCommercialId: body.ownedByCommercialId,
        ownedByCommercialName: body.ownedByCommercialName,
      );
    });
  }

  static T _body<T>(String operation, Response<T> response) {
    final T? data = response.data;
    if (data == null) {
      throw _undecodableBody(
        operation,
        response.headers.value(Headers.contentTypeHeader),
        'corps vide sur une réponse ${response.statusCode ?? 2}xx',
      );
    }
    return data;
  }

  Future<T> _guard<T>(String operation, Future<T> Function() body) async {
    try {
      return await body();
    } on DioException catch (e) {
      final Response<dynamic>? response = e.response;
      final int status = response?.statusCode ?? 0;
      if (e.type == DioExceptionType.unknown && status >= 200 && status < 300) {
        throw _undecodableBody(
          operation,
          response!.headers.value(Headers.contentTypeHeader),
          '${e.error}',
        );
      }
      throw classify(e, operation);
    } on FormatException catch (e) {
      throw _undecodableBody(
        operation,
        e is ResponseFormatException ? e.contentType : 'application/json',
        e.message,
      );
    }
  }

  static ApiException _undecodableBody(
    String operation,
    String? contentType,
    String detail,
  ) {
    final bool isJson = (contentType ?? '').toLowerCase().contains('json');
    if (!isJson) {
      return ApiException(
        nonJsonResponseCode,
        message:
            'Le réseau a répondu à la place du serveur '
            '(${contentType ?? 'type inconnu'}). Vérifiez la connexion.',
        kind: FailureKind.unreachable,
      );
    }
    return ApiException(
      'RESPONSE_SCHEMA_MISMATCH',
      message: 'Réponse serveur inattendue sur $operation : $detail',
      kind: FailureKind.terminal,
    );
  }

  static const String nonJsonResponseCode = 'NON_JSON_RESPONSE';

  static const String networkCode = 'NETWORK';
  static const String timeoutCode = 'TIMEOUT';

  static const int upgradeRequired = 426;

  static ApiException classify(DioException e, String operation) {
    if (e.error is SessionExpired) {
      return ApiException(
        'SESSION_EXPIRED',
        message: 'Session expirée. Reconnectez-vous.',
        statusCode: e.response?.statusCode,
        kind: FailureKind.sessionExpired,
      );
    }

    switch (e.type) {
      case DioExceptionType.sendTimeout:
        return const ApiException(
          ClientErrorCodes.sendTimeout,
          message: 'Le lot n\'a pas fini de partir dans le temps imparti.',
          kind: FailureKind.unreachable,
        );
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return const ApiException(
          timeoutCode,
          message: 'Le serveur n\'a pas répondu à temps.',
          kind: FailureKind.unreachable,
        );
      case DioExceptionType.connectionError:
        return const ApiException(
          networkCode,
          message: 'Réseau indisponible.',
          kind: FailureKind.unreachable,
        );
      case DioExceptionType.cancel:
        return const ApiException(
          'CANCELLED',
          message: 'Requête annulée.',
          kind: FailureKind.retryable,
        );
      case DioExceptionType.badCertificate:
        return const ApiException(
          'BAD_CERTIFICATE',
          message: 'Certificat serveur refusé.',
          kind: FailureKind.terminal,
        );
      case DioExceptionType.unknown:
      case DioExceptionType.badResponse:
        break;
    }

    final int? status = e.response?.statusCode;
    final String code =
        _serverCode(e.response?.data) ?? _defaultCode(status, operation);
    final String? message = _serverMessage(e.response?.data);

    if (status == null) {
      return ApiException(
        code,
        message: message ?? e.message,
        kind: FailureKind.retryable,
      );
    }

    if (status == 401) {
      return ApiException(
        'UNAUTHORIZED',
        message: message,
        statusCode: status,
        kind: FailureKind.sessionExpired,
      );
    }

    if (status == upgradeRequired ||
        code == ServerErrorCodes.appUpdateRequired) {
      return ApiException(
        ServerErrorCodes.appUpdateRequired,
        message:
            message ??
            'Cette version de CPI GO ne sait plus lire les données du '
                'serveur. Vos saisies continuent de partir : installez la mise '
                'à jour pour recevoir de nouveau les fiches.',
        statusCode: status,
        kind: FailureKind.appUpdateRequired,
      );
    }

    if (status == 429) {
      return ApiException(
        code,
        message: message,
        statusCode: status,
        kind: FailureKind.throttled,
        retryAfter: retryAfterOf(e.response),
      );
    }

    if (status == 409 && code == 'IDEMPOTENCY_IN_PROGRESS') {
      return ApiException(
        code,
        message: message,
        statusCode: status,
        kind: FailureKind.idempotencyInProgress,
      );
    }

    if (status == 408 || status == 425 || status >= 500) {
      return ApiException(
        code,
        message: message,
        statusCode: status,
        kind: FailureKind.retryable,
      );
    }

    if (_serverCode(e.response?.data) == null && !announcesJson(e.response)) {
      return ApiException(
        nonJsonResponseCode,
        message:
            'Le réseau a répondu à la place du serveur (HTTP $status). '
            'Vérifiez la connexion.',
        statusCode: status,
        kind: FailureKind.unreachable,
      );
    }

    return ApiException(
      code,
      message: message,
      statusCode: status,
      kind: FailureKind.terminal,
      rejectedOperations: rejectedOperationsOf(e.response?.data),
    );
  }

  static bool announcesJson(Response<dynamic>? response) =>
      retry_after.announcesJson(response);

  static Duration? retryAfterOf(Response<dynamic>? response) =>
      retry_after.retryAfterOf(response);

  static final RegExp _operationPath = RegExp(r'^operations\.(\d+)\b');

  /// Rangs des opérations que le refus nomme. La validation du serveur préfixe
  /// chaque phrase de `details` par le chemin fautif — `operations.7.data.nom` —
  /// et c'est le seul verdict par opération qu'une réponse d'erreur porte.
  static List<int> rejectedOperationsOf(Object? data) {
    if (data is! Map) return const <int>[];
    final Object? details = data['details'];
    if (details is! List) return const <int>[];
    final Set<int> ranks = <int>{};
    for (final Object? line in details) {
      final RegExpMatch? match = _operationPath.firstMatch('$line');
      if (match == null) continue;
      final int? rank = int.tryParse(match.group(1)!);
      if (rank != null) ranks.add(rank);
    }
    return ranks.toList(growable: false)..sort();
  }

  static String? _serverCode(Object? data) {
    if (data is Map && data['code'] is String) return data['code'] as String;
    return null;
  }

  static String? _serverMessage(Object? data) {
    if (data is Map) {
      final Object? m = data['message'];
      if (m is String) return m;
      if (m is List && m.isNotEmpty) return m.join(' · ');
    }
    return null;
  }

  static String _defaultCode(int? status, String operation) {
    if (status == null) return 'NETWORK';
    if (status == 401) return 'UNAUTHORIZED';
    if (status == 403) return 'FORBIDDEN';
    if (status == 404) return 'NOT_FOUND';
    if (status == 422) return 'UNPROCESSABLE';
    if (status >= 500) return 'SERVER_ERROR';
    return 'HTTP_$status';
  }
}
