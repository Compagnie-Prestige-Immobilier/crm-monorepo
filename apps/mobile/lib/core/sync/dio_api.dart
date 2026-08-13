import 'package:crm_api_client/crm_api_client.dart';
import 'package:dio/dio.dart';

import '../network/api_environment.dart';
import '../network/auth_interceptor.dart';
import '../network/session_expired.dart';
import '../network/timeout_profile.dart';
import 'api_port.dart';

/// Implémentation réelle de [ApiPort], adossée au client généré.
///
/// **Tout passe par le client généré, jamais par Dio en direct.** Un
/// `dio.post('/api/v1/sync/push', data: {...})` compilerait encore le jour où le
/// serveur renommerait un champ, et échouerait à l'exécution — chez un
/// commercial, hors ligne, sans personne pour lire l'erreur. En passant par
/// `SyncApi.pushSyncBatch`, un changement de contrat casse le build.
///
/// Le rôle de cette classe se limite donc à deux choses : appeler la bonne
/// méthode générée, et **traduire les `DioException` en [ApiException]
/// classées**. C'est cette classification qui pilote tout le comportement de
/// réessai du moteur.
class DioApi implements ApiPort {
  DioApi(this._client);

  final CrmApiClient _client;

  AuthApi get _auth => _client.getAuthApi();
  SyncApi get _sync => _client.getSyncApi();
  RepresentantsApi get _representants => _client.getRepresentantsApi();

  // ── Authentification ───────────────────────────────────────────────────────

  @override
  Future<AuthTokens> login({
    required String identifier,
    required String password,
  }) async {
    return _guard('login', () async {
      final Response<AuthTokensDto> response = await _auth.login(
        userAgent: ApiEnvironment.userAgent,
        loginDto: LoginDto(identifier: identifier, password: password),
        // Pas de porteur sur /auth/login : un jeton d'accès périmé traîné
        // jusque-là ferait rejeter une connexion pourtant valide.
        extra: <String, dynamic>{
          AuthInterceptor.noAuthFlag: true,
          ...TimeoutProfile.read.extra,
        },
      );
      return _toTokens(response.data!);
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
          ...TimeoutProfile.read.extra,
        },
      );
      return _toTokens(response.data!);
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
      // `expiresIn` est une durée en secondes ; on la matérialise en instant une
      // fois pour toutes, ici, plutôt que de recalculer « maintenant + n » à
      // chaque lecture — deux appelants ne partiraient pas du même « maintenant ».
      expiresAt: DateTime.now().toUtc().add(
        Duration(seconds: dto.expiresIn.toInt()),
      ),
      userId: dto.user.id,
      fullName: dto.user.fullName,
      role: dto.user.role.name,
      email: dto.user.email,
    );
  }

  // ── Synchronisation ────────────────────────────────────────────────────────

  @override
  Future<PullPage> pull({String? cursor, int limit = 200}) async {
    return _guard('pull', () async {
      final Response<SyncPullResponseDto> response = await _sync.pullSyncChanges(
        since: cursor,
        limit: limit,
        extra: TimeoutProfile.read.extra,
      );
      final SyncPullResponseDto body = response.data!;
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
        // Paramètre nommé typé et non un en-tête posé à la main : le contrat
        // impose `Idempotency-Key == clientBatchId`, et les deux valeurs
        // proviennent ici de la même variable — elles ne peuvent pas diverger.
        idempotencyKey: batchId,
        syncPushDto: SyncPushDto(
          clientBatchId: batchId,
          payloadVersion: payloadVersion,
          operations: operations,
        ),
        extra: TimeoutProfile.push.extra,
      );
      final SyncPushResponseDto body = response.data!;
      return PushResult(
        batchId: body.batchId,
        results: body.results,
        serverTime: body.serverTime,
      );
    });
  }

  // ── Phase 2 — chemin brut, en attendant le client généré ───────────────────
  //
  // TODO(generated-client): tout ce bloc disparaît quand `openapi.json` aura été
  // régénéré. Il est isolé ici, et nulle part ailleurs, pour que la bascule soit
  // mécanique : trois méthodes à remplacer, aucun appelant à toucher.
  //
  // Les URL et les noms de champs sont écrits en dur — c'est exactement ce que
  // le reste de ce fichier interdit, et c'est assumé le temps d'un décalage de
  // contrat. En contrepartie, le décodage est **strict** : un champ manquant ou
  // d'un type inattendu lève ici, à l'endroit où l'on sait le classer, plutôt
  // que de produire un `null` qui plantera trois écrans plus loin.

  static const String _pushPath = '/api/v1/sync/push';
  static const String _directoryPath = '/api/v1/phase2/directory';

  @override
  Future<PushResult> pushRaw({
    required String batchId,
    required int payloadVersion,
    required List<Map<String, Object?>> operations,
  }) async {
    return _guard('push', () async {
      final Response<dynamic> response = await _client.dio.post<dynamic>(
        _pushPath,
        // `Idempotency-Key` et `clientBatchId` viennent de la MÊME variable :
        // le serveur refuse en 422 si les deux diffèrent, et c'est la seule
        // écriture qui rend cette divergence impossible.
        options: Options(
          headers: <String, dynamic>{'Idempotency-Key': batchId},
          extra: TimeoutProfile.push.extra,
        ),
        data: <String, Object?>{
          'clientBatchId': batchId,
          'payloadVersion': payloadVersion,
          'operations': operations,
        },
      );
      final Map<String, Object?> body = _asMap(response.data, 'push');
      return PushResult(
        batchId: _asString(body['batchId'], 'batchId'),
        results: <SyncOperationResultDto>[
          for (final Object? raw in _asList(body['results'], 'results'))
            _toResult(_asMap(raw, 'results[]')),
        ],
        serverTime: _asDate(body['serverTime'], 'serverTime'),
      );
    });
  }

  @override
  Future<Phase2DirectoryPage> pullPhase2Directory({
    String? cursor,
    int limit = 2000,
  }) async {
    return _guard('phase2Directory', () async {
      final Response<dynamic> response = await _client.dio.get<dynamic>(
        _directoryPath,
        // `since` omis et non `null` : le serveur valide `MinLength(1)` sur ce
        // paramètre, et une chaîne vide serait rejetée en 400 alors qu'elle
        // veut dire « depuis le début ».
        queryParameters: <String, Object?>{
          if (cursor != null && cursor.isNotEmpty) 'since': cursor,
          'limit': limit,
        },
        options: Options(extra: TimeoutProfile.read.extra),
      );
      final Map<String, Object?> body = _asMap(response.data, 'directory');
      return Phase2DirectoryPage(
        entries: <Phase2DirectoryEntry>[
          for (final Object? raw in _asList(body['entries'], 'entries'))
            _toDirectoryEntry(_asMap(raw, 'entries[]')),
        ],
        nextCursor: _asString(body['nextCursor'], 'nextCursor'),
        hasMore: body['hasMore'] == true,
        serverTime: _asDate(body['serverTime'], 'serverTime'),
      );
    });
  }

  /// **Ne lit que les six champs autorisés.** Le serveur n'en envoie pas
  /// d'autres, et si un jour il en envoyait, on ne les remonterait pas : la
  /// frontière de confidentialité se tient ici aussi, pas seulement côté
  /// serveur.
  static Phase2DirectoryEntry _toDirectoryEntry(Map<String, Object?> m) {
    final Object? method = m['enrollmentMethod'];
    return Phase2DirectoryEntry(
      prospectId: _asString(m['prospectId'], 'prospectId'),
      phoneE164: _asString(m['phoneE164'], 'phoneE164'),
      phase2Status: _asString(m['phase2Status'], 'phase2Status'),
      enrollmentMethod: method == null ? null : _asString(method, 'enrollmentMethod'),
      rev: _asInt(m['rev'], 'rev'),
      updatedAt: _asDate(m['updatedAt'], 'updatedAt'),
    );
  }

  static SyncOperationResultDto _toResult(Map<String, Object?> m) {
    final Object? updatedAt = m['serverUpdatedAt'];
    return SyncOperationResultDto(
      opId: _asString(m['opId'], 'opId'),
      // `unknown_default_open_api` et non une exception : un statut inconnu vaut
      // « on ne sait pas », et le moteur le traite comme une dépendance non
      // résolue — il remet la ligne en file sans consommer de tentative. Lever
      // ici condamnerait tout le lot pour un mot nouveau.
      status: SyncOpStatus.values.firstWhere(
        (SyncOpStatus s) => s.value == m['status'],
        orElse: () => SyncOpStatus.unknownDefaultOpenApi,
      ),
      entityId: m['entityId'] as String?,
      rev: m['rev'] as num?,
      serverUpdatedAt: updatedAt == null ? null : _asDate(updatedAt, 'serverUpdatedAt'),
      errorCode: m['errorCode'] as String?,
      error: m['error'] as String?,
    );
  }

  static Map<String, Object?> _asMap(Object? value, String field) {
    if (value is Map) return value.cast<String, Object?>();
    throw FormatException('$field: objet attendu', '$value');
  }

  static List<Object?> _asList(Object? value, String field) {
    if (value is List) return value;
    throw FormatException('$field: tableau attendu', '$value');
  }

  static String _asString(Object? value, String field) {
    if (value is String) return value;
    throw FormatException('$field: chaîne attendue', '$value');
  }

  static int _asInt(Object? value, String field) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    throw FormatException('$field: nombre attendu', '$value');
  }

  static DateTime _asDate(Object? value, String field) {
    if (value is String) {
      final DateTime? parsed = DateTime.tryParse(value);
      if (parsed != null) return parsed;
    }
    throw FormatException('$field: date ISO-8601 attendue', '$value');
  }

  @override
  Future<RepresentantLookup> lookupRepresentantByPhone(String phone) async {
    return _guard('lookup', () async {
      final Response<RepresentantLookupDto> response = await _representants
          .lookupRepresentantByPhone(phone: phone, extra: TimeoutProfile.read.extra);
      final RepresentantLookupDto body = response.data!;
      return RepresentantLookup(
        found: body.found,
        phoneE164: body.phoneE164,
        representant: body.representant,
        ownedByCommercialId: body.ownedByCommercialId,
        ownedByCommercialName: body.ownedByCommercialName,
      );
    });
  }

  // ── Classification ─────────────────────────────────────────────────────────

  Future<T> _guard<T>(String operation, Future<T> Function() body) async {
    try {
      return await body();
    } on DioException catch (e) {
      throw classify(e, operation);
    } on FormatException catch (e) {
      // Le serveur a répondu 2xx avec un corps que le contrat ne décrit pas.
      // Terminal et non réessayable : rejouer produira le même corps, et huit
      // tentatives silencieuses ne feraient que retarder le moment où quelqu'un
      // s'en aperçoit.
      throw ApiException(
        'RESPONSE_SCHEMA_MISMATCH',
        message: 'Réponse serveur inattendue sur $operation : ${e.message}',
        kind: FailureKind.terminal,
      );
    }
  }

  /// Traduit une `DioException` en [ApiException] classée.
  ///
  /// Exposée (et non privée) parce que c'est la règle métier la plus dense du
  /// module réseau : elle mérite d'être testée directement, sans monter un
  /// serveur.
  static ApiException classify(DioException e, String operation) {
    // Le renouvellement de jeton a définitivement échoué : l'intercepteur a
    // déjà effacé les jetons. Rien ne repartira avant une reconnexion.
    if (e.error is SessionExpired) {
      return ApiException(
        'SESSION_EXPIRED',
        message: 'Session expirée. Reconnectez-vous.',
        statusCode: e.response?.statusCode,
        kind: FailureKind.sessionExpired,
      );
    }

    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return ApiException(
          'TIMEOUT',
          message: 'Le serveur n\'a pas répondu à temps.',
          kind: FailureKind.retryable,
        );
      case DioExceptionType.connectionError:
        // Inclut la résolution DNS. `connectivity_plus` peut très bien
        // rapporter `mobile` pendant ce temps : c'est exactement pourquoi on ne
        // s'appuie jamais sur lui pour décider d'émettre.
        return ApiException(
          'NETWORK',
          message: 'Réseau indisponible.',
          kind: FailureKind.retryable,
        );
      case DioExceptionType.cancel:
        return ApiException(
          'CANCELLED',
          message: 'Requête annulée.',
          kind: FailureKind.retryable,
        );
      case DioExceptionType.badCertificate:
        return ApiException(
          'BAD_CERTIFICATE',
          message: 'Certificat serveur refusé.',
          kind: FailureKind.terminal,
        );
      case DioExceptionType.unknown:
      case DioExceptionType.badResponse:
        break;
    }

    final int? status = e.response?.statusCode;
    final String code = _serverCode(e.response?.data) ?? _defaultCode(status, operation);
    final String? message = _serverMessage(e.response?.data);

    if (status == null) {
      return ApiException(
        code,
        message: message ?? e.message,
        kind: FailureKind.retryable,
      );
    }

    if (status == 401) {
      // On n'arrive ici qu'après l'échec du rejeu de l'intercepteur : le jeton
      // fraîchement renouvelé a été refusé lui aussi.
      return ApiException(
        'UNAUTHORIZED',
        message: message,
        statusCode: status,
        kind: FailureKind.sessionExpired,
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

    // 400, 403, 404, 409 autre, 422 : le rejouer reproduira le même refus.
    return ApiException(
      code,
      message: message,
      statusCode: status,
      kind: FailureKind.terminal,
    );
  }

  /// `Retry-After` en secondes ou en date HTTP. Les deux formes sont légales et
  /// le serveur peut passer de l'une à l'autre derrière un proxy.
  static Duration? retryAfterOf(Response<dynamic>? response) {
    final Object? raw = response?.headers.value('retry-after');
    if (raw == null) return null;
    final int? seconds = int.tryParse(raw.toString().trim());
    if (seconds != null) return Duration(seconds: seconds.clamp(0, 3600));
    final DateTime? when = DateTime.tryParse(raw.toString());
    if (when == null) return null;
    final Duration delta = when.toUtc().difference(DateTime.now().toUtc());
    return delta.isNegative ? Duration.zero : delta;
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
