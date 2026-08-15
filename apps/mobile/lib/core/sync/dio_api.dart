import 'package:crm_api_client/crm_api_client.dart';
import 'package:dio/dio.dart';

import '../network/api_environment.dart';
import '../network/auth_interceptor.dart';
import '../network/retry_after.dart' as retry_after;
import '../network/session_expired.dart';
import '../network/timeout_profile.dart';
import 'api_port.dart';

/// `FormatException` qui sait D'OÙ elle vient : le `content-type` du corps qui
/// l'a produite.
///
/// C'est cette information, et elle seule, qui distingue « le serveur nous a
/// répondu n'importe quoi » (terminal : le rejouer rendra le même corps) de
/// « quelque chose a répondu à sa place » (lien mort : rien n'a été refusé).
/// Sans elle, un portail captif condamnait deux cents saisies d'un coup.
///
/// **Aucun chemin de ce fichier ne la construit plus.** Le dernier décodage
/// écrit à la main, celui de l'annuaire de phase 2, est passé au client généré,
/// qui emballe ses échecs de désérialisation dans un `DioException` portant la
/// réponse : c'est désormais [DioApi._guard] qui y lit le `content-type`. Elle
/// reste ici parce que la règle, elle, n'est pas facultative : si un décodage
/// manuscrit réapparaissait un jour, c'est par elle qu'il doit remonter, et non
/// par une `FormatException` nue que `_guard` classerait `application/json`,
/// donc terminale.
class ResponseFormatException extends FormatException {
  ResponseFormatException(String message, this.contentType, [Object? source])
    : super(message, source);

  /// En-tête `content-type` de la réponse, tel quel. `null` quand la réponse
  /// n'en portait pas : ce qui est déjà, en soi, le signe d'un intermédiaire.
  final String? contentType;

  /// Vrai si le corps se présentait comme du JSON (`application/json`,
  /// `application/problem+json`, …).
  bool get isJson => (contentType ?? '').toLowerCase().contains('json');
}

/// Implémentation réelle de [ApiPort], adossée au client généré.
///
/// **Tout passe par le client généré, jamais par Dio en direct.** Un
/// `dio.post('/api/v1/sync/push', data: {...})` compilerait encore le jour où le
/// serveur renommerait un champ, et échouerait à l'exécution : chez un
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
  Phase2Api get _phase2 => _client.getPhase2Api();
  RepresentantsApi get _representants => _client.getRepresentantsApi();

  // ── Authentification ───────────────────────────────────────────────────────

  @override
  Future<AuthTokens> login({required String identifier, required String password}) async {
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
          ...TimeoutProfile.read.extra,
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
      // `expiresIn` est une durée en secondes ; on la matérialise en instant une
      // fois pour toutes, ici, plutôt que de recalculer « maintenant + n » à
      // chaque lecture : deux appelants ne partiraient pas du même « maintenant ».
      expiresAt: DateTime.now().toUtc().add(Duration(seconds: dto.expiresIn.toInt())),
      userId: dto.user.id,
      fullName: dto.user.fullName,
      // `.value` et non `.name` : `Role.BANQUE_FINANCE.name` rendrait
      // `BANQUE_FINANCE` par chance (les deux coïncident), mais
      // `Role.unknownDefaultOpenApi.name` rendrait `unknownDefaultOpenApi` au
      // lieu de la chaîne réellement reçue. `.value` est le contrat.
      role: dto.user.role.value,
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
        // Paramètre nommé typé et non un en-tête posé à la main : le contrat
        // impose `Idempotency-Key == clientBatchId`, et les deux valeurs
        // proviennent ici de la même variable : elles ne peuvent pas diverger.
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

  // ── Phase 2 : annuaire hors ligne ─────────────────────────────────────────

  @override
  Future<Phase2DirectoryPage> pullPhase2Directory({
    String? cursor,
    int limit = 2000,
  }) async {
    return _guard('phase2Directory', () async {
      final Response<DirectoryPageDto> response = await _phase2.pullPhase2Directory(
        // ═══ `since` OMIS, JAMAIS VIDE ═══
        //
        // `DirectoryQueryDto` valide `@MinLength(1)` sur ce paramètre côté
        // serveur, et cette contrainte **n'apparaît pas** dans `openapi.json` :
        // le client généré n'omet donc que `null` et mettrait `since=` sur le
        // fil pour une chaîne vide. Or une chaîne vide veut dire « depuis le
        // début », c'est-à-dire le tout premier téléchargement d'annuaire, et
        // le serveur la refuserait en 400 : classé `terminal`, ce refus rendrait
        // la phase 2 inutilisable pour un commercial qui vient d'installer
        // l'app. La normalisation se fait donc ici, à l'entrée du client généré.
        since: (cursor == null || cursor.isEmpty) ? null : cursor,
        limit: limit,
        // Le client généré n'expose pas de paramètre de délai d'attente : le
        // profil passe par `Options.extra`, que `TimeoutProfileInterceptor` lit
        // pour poser `receiveTimeout`. Sans lui, les 3 s que Dio se donne par
        // défaut ne ramènent jamais une page de 2 000 entrées sur un lien 2G.
        extra: TimeoutProfile.read.extra,
      );
      final DirectoryPageDto body = _body('phase2Directory', response);
      return Phase2DirectoryPage(
        entries: <Phase2DirectoryEntry>[
          for (final DirectoryEntryDto entry in body.entries) _toDirectoryEntry(entry),
        ],
        nextCursor: body.nextCursor,
        hasMore: body.hasMore,
        serverTime: body.serverTime,
      );
    });
  }

  /// **Recopie les six champs autorisés, un par un.**
  ///
  /// Le DTO généré ne traverse PAS cette frontière : ni stocké, ni exposé au
  /// domaine. L'annuaire est répliqué sur le téléphone personnel de chaque
  /// commercial et couvre tout le portefeuille ; le nom, la banque et le
  /// syndicat en sont absents délibérément. Le jour où le serveur ajoutera un
  /// septième champ à `DirectoryEntryDto`, la régénération du client le fera
  /// apparaître **sans bruit**, et cette recopie explicite est la seule chose
  /// qui l'empêche d'atterrir dans la base locale. La frontière de
  /// confidentialité se tient donc ici aussi, pas seulement côté serveur.
  static Phase2DirectoryEntry _toDirectoryEntry(DirectoryEntryDto dto) {
    return Phase2DirectoryEntry(
      prospectId: dto.prospectId,
      phoneE164: dto.phoneE164,
      // `.value` et non `.name` : sur un membre que ce client ne connaît pas
      // encore, `.name` rendrait `unknownDefaultOpenApi`, un identifiant Dart
      // qui n'existe nulle part dans le contrat. `.value` rend la chaîne du
      // contrat, et pour ce membre-là la chaîne convenue pour « inconnu ».
      phase2Status: dto.phase2Status.value,
      enrollmentMethod: dto.enrollmentMethod?.value,
      // `rev` est un `num` dans le contrat, parce que JSON ne distingue pas
      // entier et flottant ; la colonne locale est un entier. La conversion se
      // fait ici, une fois, plutôt qu'à chaque lecture.
      rev: dto.rev.toInt(),
      updatedAt: dto.updatedAt,
    );
  }

  @override
  Future<RepresentantLookup> lookupRepresentantByPhone(String phone) async {
    return _guard('lookup', () async {
      final Response<RepresentantLookupDto> response = await _representants
          .lookupRepresentantByPhone(phone: phone, extra: TimeoutProfile.read.extra);
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

  // ── Classification ─────────────────────────────────────────────────────────

  /// Le corps d'une réponse 2xx, ou une [ApiException] classée s'il est vide.
  ///
  /// ═══ `response.data!` LÈVE HORS DE TOUTE CLASSIFICATION ═══
  ///
  /// Le client généré rend `Response<T>` avec un `data` nullable, et un 2xx à
  /// corps vide : c'est ce que renvoie un proxy d'opérateur qui tronque, un
  /// portail captif qui répond 200 sans rien, un load balancer qui coupe :
  /// laissait le `!` lever une `TypeError`. Ni `DioException`, ni
  /// `FormatException` : [_guard] ne l'attrapait donc pas, elle traversait
  /// `_sendBatch`, `drain` et `runOnce`, dont les `catch` ne visent que
  /// [ApiException].
  ///
  /// Conséquence exacte : la ligne restait en `syncing`, bail vivant, plus
  /// personne pour la reprendre avant l'expiration du bail, et le cycle entier
  /// mourait sans que l'interface puisse rien en dire. Le worker WorkManager, à
  /// qui l'exception remontait, ne se reprogrammait pas non plus.
  ///
  /// On repasse donc par [_undecodableBody], qui décide sur le `content-type` :
  /// un corps vide non annoncé JSON est un lien mort (aucune tentative comptée,
  /// aucun lot condamné), un corps vide annoncé JSON est bien une faute du
  /// serveur.
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
      // ═══ UN 2xx INDÉCODABLE N'EST PAS UN 2xx ANORMAL ═══
      //
      // Le client généré emballe TOUT échec de désérialisation dans un
      // `DioException(type: unknown)` auquel il attache la réponse. `classify`
      // n'y lisait qu'un statut 200 inattendu et rendait `HTTP_200`, classé
      // terminal : le portail captif d'un hôtel ou d'une salle de formation
      // condamnait donc le lot entier, jusqu'à deux cents saisies à reprendre
      // une par une dans « À corriger ».
      //
      // Cette protection n'existait que sur l'ancien chemin brut, écrit à la
      // main, et donc que pour la phase 2. Elle vaut pour toutes les routes du
      // client généré, et c'est ici qu'elle appartient.
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

  /// Classe un corps 2xx qu'on n'a pas su lire, à partir de son `content-type`.
  ///
  /// Un corps non annoncé JSON ne dit rien du serveur : il dit qu'on ne lui a
  /// pas parlé. Portail captif, page d'erreur d'un proxy, redirection
  /// d'opérateur : c'est un lien mort, donc aucune tentative comptée, aucun lot
  /// condamné. Seul un corps annoncé JSON et illisible justifie un verdict
  /// terminal : là c'est bien le serveur qui a tort, et le rejouer rendrait le
  /// même corps.
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

  /// Code rendu quand le corps 2xx n'est pas du JSON.
  static const String nonJsonResponseCode = 'NON_JSON_RESPONSE';

  /// Codes de lien mort. Ils partagent tous [FailureKind.unreachable] : c'est
  /// ce classement, et non le code, sur lequel le moteur et l'interface
  /// raisonnent.
  static const String networkCode = 'NETWORK';
  static const String timeoutCode = 'TIMEOUT';

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
        // `unreachable` et non `retryable` : un délai dépassé n'est pas un refus
        // du serveur, c'est l'absence de réponse. Compté comme une tentative,
        // il faisait mourir en `ATTEMPTS_EXHAUSTED` des saisies parfaitement
        // valides au bout de quelques minutes de lien dégradé.
        return ApiException(
          timeoutCode,
          message: 'Le serveur n\'a pas répondu à temps.',
          kind: FailureKind.unreachable,
        );
      case DioExceptionType.connectionError:
        // Inclut la résolution DNS. `connectivity_plus` peut très bien
        // rapporter `mobile` pendant ce temps : c'est exactement pourquoi on ne
        // s'appuie jamais sur lui pour décider d'émettre.
        //
        // `unreachable` : pas de route, plus de crédit data, antenne absente.
        // Le serveur n'a rien reçu, donc rien refusé, donc rien à compter.
        return ApiException(
          networkCode,
          message: 'Réseau indisponible.',
          kind: FailureKind.unreachable,
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

    // ═══ UN REFUS QUI N'EST PAS DU JSON NE VIENT PAS DU SERVEUR ═══
    //
    // La règle du portail captif ne s'appliquait qu'aux 2xx (voir [_guard]).
    // Or un portail ne répond pas forcément 200 : beaucoup rendent 403 avec une
    // page HTML de connexion, et certains proxys d'entreprise font pareil. Cette
    // réponse-là tombait dans la branche terminale ci-dessous et condamnait le
    // lot entier, jusqu'à deux cents saisies à reprendre une par une dans
    // « À corriger », pour un problème qui se règle en acceptant les conditions
    // du wifi de l'hôtel.
    //
    // Les deux conditions comptent, et il faut les deux. Un refus légitime de
    // notre API porte TOUJOURS un corps JSON avec un `code` : c'est le contrat
    // du serveur. Une réponse sans code lisible ET dont le `content-type`
    // n'annonce pas du JSON ne dit rien de nos données ; elle dit qu'on n'a pas
    // parlé au serveur. On la classe donc comme un lien mort : aucune tentative
    // comptée, aucun lot condamné, et la file repart d'elle-même dès que le
    // portail est franchi.
    //
    // 511 et 302 n'ont pas besoin de ce filet : le premier est déjà `>= 500`
    // donc rejouable, le second est suivi par dio avant d'arriver ici.
    if (_serverCode(e.response?.data) == null && !_announcesJson(e.response)) {
      return ApiException(
        nonJsonResponseCode,
        message:
            'Le réseau a répondu à la place du serveur (HTTP $status). '
            'Vérifiez la connexion.',
        statusCode: status,
        kind: FailureKind.unreachable,
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

  /// Le corps s'annonce-t-il comme du JSON ?
  ///
  /// Un `content-type` absent compte comme « pas du JSON » : notre serveur le
  /// renseigne toujours, un équipement intermédiaire non.
  static bool _announcesJson(Response<dynamic>? response) =>
      (response?.headers.value(Headers.contentTypeHeader) ?? '')
          .toLowerCase()
          .contains('json');

  /// `Retry-After` en secondes ou en date HTTP.
  ///
  /// Délègue à `core/network/retry_after.dart` : l'intercepteur de réessai des
  /// GET lit le même en-tête, et deux lectures divergentes produiraient deux
  /// politiques de throttling contradictoires sur le même serveur.
  static Duration? retryAfterOf(Response<dynamic>? response) =>
      retry_after.retryAfterOf(response);

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
