//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

// ignore: unused_import
import 'dart:convert';
import 'package:crm_api_client/src/deserialize.dart';
import 'package:dio/dio.dart';

import 'package:crm_api_client/src/model/api_error_dto.dart';
import 'package:crm_api_client/src/model/bank_case_analytics_dto.dart';
import 'package:crm_api_client/src/model/bank_case_detail_dto.dart';
import 'package:crm_api_client/src/model/bank_case_dto.dart';
import 'package:crm_api_client/src/model/bank_case_list_dto.dart';
import 'package:crm_api_client/src/model/bank_case_sort_field.dart';
import 'package:crm_api_client/src/model/bank_rejection_reason_list_dto.dart';
import 'package:crm_api_client/src/model/bank_stage_type.dart';
import 'package:crm_api_client/src/model/create_bank_case_correction_dto.dart';
import 'package:crm_api_client/src/model/create_bank_case_dto.dart';
import 'package:crm_api_client/src/model/create_bank_case_transition_dto.dart';
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/prospect_search_list_dto.dart';
import 'package:crm_api_client/src/model/sort_order.dart';
import 'package:crm_api_client/src/model/time_granularity.dart';
import 'package:crm_api_client/src/model/update_bank_case_dto.dart';

class BankCasesApi {
  final Dio _dio;

  const BankCasesApi(this._dio);

  /// Ouvre un dossier sur un prospect enrôlé.
  /// Le prospect doit être en phase 2 METHOD_OBTAINED. L’identité du client est COPIÉE sur le dossier et n’est plus jamais réécrite : corriger le prospect ensuite ne change pas ce qui a été transmis à la banque.
  ///
  /// Parameters:
  /// * [createBankCaseDto]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [BankCaseDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<BankCaseDto>> createBankCase({
    required CreateBankCaseDto createBankCaseDto,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/bank-cases';
    final _options = Options(
      method: r'POST',
      headers: <String, dynamic>{...?headers},
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {'type': 'http', 'scheme': 'bearer', 'name': 'bearer'},
        ],
        ...?extra,
      },
      contentType: 'application/json',
      validateStatus: validateStatus,
    );

    dynamic _bodyData;

    try {
      _bodyData = jsonEncode(createBankCaseDto);
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _options.compose(_dio.options, _path),
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    final _response = await _dio.request<Object>(
      _path,
      data: _bodyData,
      options: _options,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    BankCaseDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<BankCaseDto, BankCaseDto>(
              rawData,
              'BankCaseDto',
              growable: true,
            );
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<BankCaseDto>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }

  /// Correction administrateur d’un dossier, y compris terminal.
  /// Contourne l’atteignabilité et le verrou terminal, RIEN d’autre : les règles financières de l’étape visée s’appliquent à l’identique et la justification est obligatoire. La correction s’inscrit dans le même historique append-only, marquée par &#x60;correctionReason&#x60;.
  ///
  /// Parameters:
  /// * [id]
  /// * [createBankCaseCorrectionDto]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [BankCaseDetailDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<BankCaseDetailDto>> createBankCaseCorrection({
    required String id,
    required CreateBankCaseCorrectionDto createBankCaseCorrectionDto,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/bank-cases/{id}/corrections'.replaceAll(
      '{'
      r'id'
      '}',
      id.toString(),
    );
    final _options = Options(
      method: r'POST',
      headers: <String, dynamic>{...?headers},
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {'type': 'http', 'scheme': 'bearer', 'name': 'bearer'},
        ],
        ...?extra,
      },
      contentType: 'application/json',
      validateStatus: validateStatus,
    );

    dynamic _bodyData;

    try {
      _bodyData = jsonEncode(createBankCaseCorrectionDto);
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _options.compose(_dio.options, _path),
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    final _response = await _dio.request<Object>(
      _path,
      data: _bodyData,
      options: _options,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    BankCaseDetailDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<BankCaseDetailDto, BankCaseDetailDto>(
              rawData,
              'BankCaseDetailDto',
              growable: true,
            );
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<BankCaseDetailDto>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }

  /// Fait avancer le dossier vers l’étape suivante atteignable.
  /// L’encaissement exige un montant strictement positif et ne se déclare qu’à la dernière étape ouverte. Le rejet exige un motif ; son montant est forcé à zéro par le serveur. Le motif « AUTRE » exige en plus une précision.
  ///
  /// Parameters:
  /// * [id]
  /// * [createBankCaseTransitionDto]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [BankCaseDetailDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<BankCaseDetailDto>> createBankCaseTransition({
    required String id,
    required CreateBankCaseTransitionDto createBankCaseTransitionDto,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/bank-cases/{id}/transitions'.replaceAll(
      '{'
      r'id'
      '}',
      id.toString(),
    );
    final _options = Options(
      method: r'POST',
      headers: <String, dynamic>{...?headers},
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {'type': 'http', 'scheme': 'bearer', 'name': 'bearer'},
        ],
        ...?extra,
      },
      contentType: 'application/json',
      validateStatus: validateStatus,
    );

    dynamic _bodyData;

    try {
      _bodyData = jsonEncode(createBankCaseTransitionDto);
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _options.compose(_dio.options, _path),
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    final _response = await _dio.request<Object>(
      _path,
      data: _bodyData,
      options: _options,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    BankCaseDetailDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<BankCaseDetailDto, BankCaseDetailDto>(
              rawData,
              'BankCaseDetailDto',
              growable: true,
            );
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<BankCaseDetailDto>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }

  /// Dossier, étape courante et historique complet.
  ///
  ///
  /// Parameters:
  /// * [id]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [BankCaseDetailDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<BankCaseDetailDto>> getBankCase({
    required String id,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/bank-cases/{id}'.replaceAll(
      '{'
      r'id'
      '}',
      id.toString(),
    );
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{...?headers},
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {'type': 'http', 'scheme': 'bearer', 'name': 'bearer'},
        ],
        ...?extra,
      },
      validateStatus: validateStatus,
    );

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    BankCaseDetailDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<BankCaseDetailDto, BankCaseDetailDto>(
              rawData,
              'BankCaseDetailDto',
              growable: true,
            );
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<BankCaseDetailDto>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }

  /// Tableau de bord Banque &amp; Finance, avec le filtre de la liste.
  /// Tout est agrégé en SQL. Les compteurs sont, par construction, ceux de la liste filtrée à l’identique.
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur la référence, le nom du client ou son téléphone.
  /// * [stageId]
  /// * [stageType]
  /// * [banqueId] - Banque de traitement du dossier.
  /// * [projet] - Projet d’entrée de la fiche liée. Sans filtre, les deux projets sortent.
  /// * [agentId] - Agent créateur OU dernier intervenant sur le dossier.
  /// * [rejectionReasonId]
  /// * [dateFrom] - Borne basse sur la création, incluse.
  /// * [dateTo] - Borne haute sur la création, incluse.
  /// * [amountMin] - Borne basse de montant. Montant en francs CFA, entier, exposé en chaîne. XOF n’a pas de décimales et un nombre JSON perdrait de la précision au-delà de 2^53.
  /// * [amountMax] - Borne haute de montant. Montant en francs CFA, entier, exposé en chaîne. XOF n’a pas de décimales et un nombre JSON perdrait de la précision au-delà de 2^53.
  /// * [granularity]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [BankCaseAnalyticsDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<BankCaseAnalyticsDto>> getBankCaseAnalytics({
    String? search,
    String? stageId,
    BankStageType? stageType,
    String? banqueId,
    Projet? projet,
    String? agentId,
    String? rejectionReasonId,
    DateTime? dateFrom,
    DateTime? dateTo,
    String? amountMin,
    String? amountMax,
    TimeGranularity? granularity,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/bank-cases/analytics';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{...?headers},
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {'type': 'http', 'scheme': 'bearer', 'name': 'bearer'},
        ],
        ...?extra,
      },
      validateStatus: validateStatus,
    );

    final _queryParameters = <String, dynamic>{
      if (search != null) r'search': search,
      if (stageId != null) r'stageId': stageId,
      if (stageType != null) r'stageType': stageType,
      if (banqueId != null) r'banqueId': banqueId,
      if (projet != null) r'projet': projet,
      if (agentId != null) r'agentId': agentId,
      if (rejectionReasonId != null) r'rejectionReasonId': rejectionReasonId,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (amountMin != null) r'amountMin': amountMin,
      if (amountMax != null) r'amountMax': amountMax,
      if (granularity != null) r'granularity': granularity,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    BankCaseAnalyticsDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<BankCaseAnalyticsDto, BankCaseAnalyticsDto>(
              rawData,
              'BankCaseAnalyticsDto',
              growable: true,
            );
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<BankCaseAnalyticsDto>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }

  /// Liste filtrée, triée et paginée des dossiers bancaires.
  /// La recherche libre porte sur la référence, le nom du client et son téléphone. Le filtre est exactement celui des agrégats et de l’export.
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur la référence, le nom du client ou son téléphone.
  /// * [stageId]
  /// * [stageType]
  /// * [banqueId] - Banque de traitement du dossier.
  /// * [projet] - Projet d’entrée de la fiche liée. Sans filtre, les deux projets sortent.
  /// * [agentId] - Agent créateur OU dernier intervenant sur le dossier.
  /// * [rejectionReasonId]
  /// * [dateFrom] - Borne basse sur la création, incluse.
  /// * [dateTo] - Borne haute sur la création, incluse.
  /// * [amountMin] - Borne basse de montant. Montant en francs CFA, entier, exposé en chaîne. XOF n’a pas de décimales et un nombre JSON perdrait de la précision au-delà de 2^53.
  /// * [amountMax] - Borne haute de montant. Montant en francs CFA, entier, exposé en chaîne. XOF n’a pas de décimales et un nombre JSON perdrait de la précision au-delà de 2^53.
  /// * [page]
  /// * [pageSize]
  /// * [sortBy]
  /// * [sortOrder]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [BankCaseListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<BankCaseListDto>> listBankCases({
    String? search,
    String? stageId,
    BankStageType? stageType,
    String? banqueId,
    Projet? projet,
    String? agentId,
    String? rejectionReasonId,
    DateTime? dateFrom,
    DateTime? dateTo,
    String? amountMin,
    String? amountMax,
    num? page = 1,
    num? pageSize = 25,
    BankCaseSortField? sortBy,
    SortOrder? sortOrder,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/bank-cases';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{...?headers},
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {'type': 'http', 'scheme': 'bearer', 'name': 'bearer'},
        ],
        ...?extra,
      },
      validateStatus: validateStatus,
    );

    final _queryParameters = <String, dynamic>{
      if (search != null) r'search': search,
      if (stageId != null) r'stageId': stageId,
      if (stageType != null) r'stageType': stageType,
      if (banqueId != null) r'banqueId': banqueId,
      if (projet != null) r'projet': projet,
      if (agentId != null) r'agentId': agentId,
      if (rejectionReasonId != null) r'rejectionReasonId': rejectionReasonId,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (amountMin != null) r'amountMin': amountMin,
      if (amountMax != null) r'amountMax': amountMax,
      if (page != null) r'page': page,
      if (pageSize != null) r'pageSize': pageSize,
      if (sortBy != null) r'sortBy': sortBy,
      if (sortOrder != null) r'sortOrder': sortOrder,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    BankCaseListDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<BankCaseListDto, BankCaseListDto>(
              rawData,
              'BankCaseListDto',
              growable: true,
            );
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<BankCaseListDto>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }

  /// Référentiel des motifs de rejet.
  ///
  ///
  /// Parameters:
  /// * [includeInactive] - Inclure les entrées désactivées. Utile à l’administration du workflow.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [BankRejectionReasonListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<BankRejectionReasonListDto>> listBankRejectionReasons({
    bool? includeInactive = false,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/bank-cases/rejection-reasons';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{...?headers},
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {'type': 'http', 'scheme': 'bearer', 'name': 'bearer'},
        ],
        ...?extra,
      },
      validateStatus: validateStatus,
    );

    final _queryParameters = <String, dynamic>{
      if (includeInactive != null) r'includeInactive': includeInactive,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    BankRejectionReasonListDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<BankRejectionReasonListDto, BankRejectionReasonListDto>(
              rawData,
              'BankRejectionReasonListDto',
              growable: true,
            );
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<BankRejectionReasonListDto>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }

  /// Autocomplétion des prospects enrôlés, pour ouvrir un dossier.
  /// Projection VOLONTAIREMENT étroite : identité, téléphone et banque courante, rien d’autre. Un agent Banque &amp; Finance n’a pas à voir le commercial propriétaire, le syndicat ni le statut de prospection.
  ///
  /// Parameters:
  /// * [search] - Nom (insensible à la casse et aux accents) ou téléphone sous n’importe quelle forme écrite.
  /// * [page]
  /// * [pageSize]
  /// * [projet] - Ne propose que les fiches entrées par ce projet. Sans filtre, les deux.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [ProspectSearchListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<ProspectSearchListDto>> searchBankCaseProspects({
    required String search,
    num? page = 1,
    num? pageSize = 20,
    Projet? projet,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/bank-cases/prospect-search';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{...?headers},
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {'type': 'http', 'scheme': 'bearer', 'name': 'bearer'},
        ],
        ...?extra,
      },
      validateStatus: validateStatus,
    );

    final _queryParameters = <String, dynamic>{
      r'search': search,
      if (page != null) r'page': page,
      if (pageSize != null) r'pageSize': pageSize,
      if (projet != null) r'projet': projet,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    ProspectSearchListDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<ProspectSearchListDto, ProspectSearchListDto>(
              rawData,
              'ProspectSearchListDto',
              growable: true,
            );
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<ProspectSearchListDto>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }

  /// Corrige la référence ou la banque de traitement d’un dossier ouvert.
  /// Ni l’étape, ni le montant, ni le motif : ceux-là ne changent que par une transition, qui laisse une trace. Refusé sur un dossier terminal.
  ///
  /// Parameters:
  /// * [id]
  /// * [updateBankCaseDto]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [BankCaseDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<BankCaseDto>> updateBankCase({
    required String id,
    required UpdateBankCaseDto updateBankCaseDto,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/bank-cases/{id}'.replaceAll(
      '{'
      r'id'
      '}',
      id.toString(),
    );
    final _options = Options(
      method: r'PATCH',
      headers: <String, dynamic>{...?headers},
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {'type': 'http', 'scheme': 'bearer', 'name': 'bearer'},
        ],
        ...?extra,
      },
      contentType: 'application/json',
      validateStatus: validateStatus,
    );

    dynamic _bodyData;

    try {
      _bodyData = jsonEncode(updateBankCaseDto);
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _options.compose(_dio.options, _path),
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    final _response = await _dio.request<Object>(
      _path,
      data: _bodyData,
      options: _options,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    BankCaseDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<BankCaseDto, BankCaseDto>(
              rawData,
              'BankCaseDto',
              growable: true,
            );
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<BankCaseDto>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }
}
