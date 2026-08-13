//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

// ignore: unused_import
import 'dart:convert';
import 'package:crm_api_client/src/deserialize.dart';
import 'package:dio/dio.dart';

import 'package:crm_api_client/src/model/analytics_funnel_dto.dart';
import 'package:crm_api_client/src/model/analytics_series_dto.dart';
import 'package:crm_api_client/src/model/analytics_totals_dto.dart';
import 'package:crm_api_client/src/model/bdd_segment.dart';
import 'package:crm_api_client/src/model/enrollment_method.dart';
import 'package:crm_api_client/src/model/enrollment_method_list_dto.dart';
import 'package:crm_api_client/src/model/named_count_list_dto.dart';
import 'package:crm_api_client/src/model/phase2_status.dart';
import 'package:crm_api_client/src/model/phase2_status_list_dto.dart';
import 'package:crm_api_client/src/model/prospect_statut.dart';
import 'package:crm_api_client/src/model/segment_list_dto.dart';
import 'package:crm_api_client/src/model/time_granularity.dart';
import 'package:crm_api_client/src/model/top_commercial_list_dto.dart';
import 'package:crm_api_client/src/model/top_representant_list_dto.dart';

class AnalyticsApi {
  final Dio _dio;

  const AnalyticsApi(this._dio);

  /// Entonnoir complet et montants encaissés.
  /// Du prospect saisi au dossier encaissé, plus les montants. Le tableau de bord montrait l’effort — prospects, représentants, téléconseillers — mais jamais le résultat. Une direction qui ne voit que le haut de l’entonnoir peut féliciter une équipe qui saisit beaucoup et ne convertit rien.
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId]
  /// * [banqueId]
  /// * [syndicatId]
  /// * [departementId]
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [statut]
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [campaignId] - Campagne d’appels : ne retient que les prospects portant une tâche de cette campagne.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [includeDeleted] - Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [AnalyticsFunnelDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<AnalyticsFunnelDto>> getAnalyticsFunnel({
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? campaignId,
    String? enrollmentCapturedById,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted = false,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/analytics/funnel';
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
      if (representantId != null) r'representantId': representantId,
      if (banqueId != null) r'banqueId': banqueId,
      if (syndicatId != null) r'syndicatId': syndicatId,
      if (departementId != null) r'departementId': departementId,
      if (commercialId != null) r'commercialId': commercialId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (campaignId != null) r'campaignId': campaignId,
      if (enrollmentCapturedById != null)
        r'enrollmentCapturedById': enrollmentCapturedById,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (includeDeleted != null) r'includeDeleted': includeDeleted,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    AnalyticsFunnelDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<AnalyticsFunnelDto, AnalyticsFunnelDto>(
              rawData,
              'AnalyticsFunnelDto',
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

    return Response<AnalyticsFunnelDto>(
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

  /// Compteurs de tête.
  ///
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId]
  /// * [banqueId]
  /// * [syndicatId]
  /// * [departementId]
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [statut]
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [campaignId] - Campagne d’appels : ne retient que les prospects portant une tâche de cette campagne.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [includeDeleted] - Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [AnalyticsTotalsDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<AnalyticsTotalsDto>> getAnalyticsTotals({
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? campaignId,
    String? enrollmentCapturedById,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted = false,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/analytics/totals';
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
      if (representantId != null) r'representantId': representantId,
      if (banqueId != null) r'banqueId': banqueId,
      if (syndicatId != null) r'syndicatId': syndicatId,
      if (departementId != null) r'departementId': departementId,
      if (commercialId != null) r'commercialId': commercialId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (campaignId != null) r'campaignId': campaignId,
      if (enrollmentCapturedById != null)
        r'enrollmentCapturedById': enrollmentCapturedById,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (includeDeleted != null) r'includeDeleted': includeDeleted,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    AnalyticsTotalsDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<AnalyticsTotalsDto, AnalyticsTotalsDto>(
              rawData,
              'AnalyticsTotalsDto',
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

    return Response<AnalyticsTotalsDto>(
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

  /// Répartition par banque.
  ///
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId]
  /// * [banqueId]
  /// * [syndicatId]
  /// * [departementId]
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [statut]
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [campaignId] - Campagne d’appels : ne retient que les prospects portant une tâche de cette campagne.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [includeDeleted] - Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [NamedCountListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<NamedCountListDto>> getProspectsByBanque({
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? campaignId,
    String? enrollmentCapturedById,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted = false,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/analytics/by-banque';
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
      if (representantId != null) r'representantId': representantId,
      if (banqueId != null) r'banqueId': banqueId,
      if (syndicatId != null) r'syndicatId': syndicatId,
      if (departementId != null) r'departementId': departementId,
      if (commercialId != null) r'commercialId': commercialId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (campaignId != null) r'campaignId': campaignId,
      if (enrollmentCapturedById != null)
        r'enrollmentCapturedById': enrollmentCapturedById,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (includeDeleted != null) r'includeDeleted': includeDeleted,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    NamedCountListDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<NamedCountListDto, NamedCountListDto>(
              rawData,
              'NamedCountListDto',
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

    return Response<NamedCountListDto>(
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

  /// Répartition par département.
  ///
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId]
  /// * [banqueId]
  /// * [syndicatId]
  /// * [departementId]
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [statut]
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [campaignId] - Campagne d’appels : ne retient que les prospects portant une tâche de cette campagne.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [includeDeleted] - Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [NamedCountListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<NamedCountListDto>> getProspectsByDepartement({
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? campaignId,
    String? enrollmentCapturedById,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted = false,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/analytics/by-departement';
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
      if (representantId != null) r'representantId': representantId,
      if (banqueId != null) r'banqueId': banqueId,
      if (syndicatId != null) r'syndicatId': syndicatId,
      if (departementId != null) r'departementId': departementId,
      if (commercialId != null) r'commercialId': commercialId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (campaignId != null) r'campaignId': campaignId,
      if (enrollmentCapturedById != null)
        r'enrollmentCapturedById': enrollmentCapturedById,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (includeDeleted != null) r'includeDeleted': includeDeleted,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    NamedCountListDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<NamedCountListDto, NamedCountListDto>(
              rawData,
              'NamedCountListDto',
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

    return Response<NamedCountListDto>(
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

  /// Répartition des méthodes d’enrôlement obtenues.
  /// Ne compte que les prospects porteurs d’une méthode ; &#x60;total&#x60; est celui de cette sous-population.
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId]
  /// * [banqueId]
  /// * [syndicatId]
  /// * [departementId]
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [statut]
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [campaignId] - Campagne d’appels : ne retient que les prospects portant une tâche de cette campagne.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [includeDeleted] - Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [EnrollmentMethodListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<EnrollmentMethodListDto>> getProspectsByEnrollmentMethod({
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? campaignId,
    String? enrollmentCapturedById,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted = false,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/analytics/by-enrollment-method';
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
      if (representantId != null) r'representantId': representantId,
      if (banqueId != null) r'banqueId': banqueId,
      if (syndicatId != null) r'syndicatId': syndicatId,
      if (departementId != null) r'departementId': departementId,
      if (commercialId != null) r'commercialId': commercialId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (campaignId != null) r'campaignId': campaignId,
      if (enrollmentCapturedById != null)
        r'enrollmentCapturedById': enrollmentCapturedById,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (includeDeleted != null) r'includeDeleted': includeDeleted,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    EnrollmentMethodListDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<EnrollmentMethodListDto, EnrollmentMethodListDto>(
              rawData,
              'EnrollmentMethodListDto',
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

    return Response<EnrollmentMethodListDto>(
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

  /// Avancement de la phase 2, par statut.
  /// Les quatre statuts sont toujours présents, à zéro s’il le faut.
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId]
  /// * [banqueId]
  /// * [syndicatId]
  /// * [departementId]
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [statut]
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [campaignId] - Campagne d’appels : ne retient que les prospects portant une tâche de cette campagne.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [includeDeleted] - Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [Phase2StatusListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<Phase2StatusListDto>> getProspectsByPhase2Status({
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? campaignId,
    String? enrollmentCapturedById,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted = false,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/analytics/by-phase2-status';
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
      if (representantId != null) r'representantId': representantId,
      if (banqueId != null) r'banqueId': banqueId,
      if (syndicatId != null) r'syndicatId': syndicatId,
      if (departementId != null) r'departementId': departementId,
      if (commercialId != null) r'commercialId': commercialId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (campaignId != null) r'campaignId': campaignId,
      if (enrollmentCapturedById != null)
        r'enrollmentCapturedById': enrollmentCapturedById,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (includeDeleted != null) r'includeDeleted': includeDeleted,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    Phase2StatusListDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<Phase2StatusListDto, Phase2StatusListDto>(
              rawData,
              'Phase2StatusListDto',
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

    return Response<Phase2StatusListDto>(
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

  /// Répartition BDD1–BDD4.
  /// Segment calculé par croisement syndicat × banque, via la définition partagée @crm/database.
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId]
  /// * [banqueId]
  /// * [syndicatId]
  /// * [departementId]
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [statut]
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [campaignId] - Campagne d’appels : ne retient que les prospects portant une tâche de cette campagne.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [includeDeleted] - Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [SegmentListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<SegmentListDto>> getProspectsBySegment({
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? campaignId,
    String? enrollmentCapturedById,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted = false,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/analytics/by-segment';
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
      if (representantId != null) r'representantId': representantId,
      if (banqueId != null) r'banqueId': banqueId,
      if (syndicatId != null) r'syndicatId': syndicatId,
      if (departementId != null) r'departementId': departementId,
      if (commercialId != null) r'commercialId': commercialId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (campaignId != null) r'campaignId': campaignId,
      if (enrollmentCapturedById != null)
        r'enrollmentCapturedById': enrollmentCapturedById,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (includeDeleted != null) r'includeDeleted': includeDeleted,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    SegmentListDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<SegmentListDto, SegmentListDto>(
              rawData,
              'SegmentListDto',
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

    return Response<SegmentListDto>(
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

  /// Répartition par syndicat.
  ///
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId]
  /// * [banqueId]
  /// * [syndicatId]
  /// * [departementId]
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [statut]
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [campaignId] - Campagne d’appels : ne retient que les prospects portant une tâche de cette campagne.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [includeDeleted] - Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [NamedCountListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<NamedCountListDto>> getProspectsBySyndicat({
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? campaignId,
    String? enrollmentCapturedById,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted = false,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/analytics/by-syndicat';
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
      if (representantId != null) r'representantId': representantId,
      if (banqueId != null) r'banqueId': banqueId,
      if (syndicatId != null) r'syndicatId': syndicatId,
      if (departementId != null) r'departementId': departementId,
      if (commercialId != null) r'commercialId': commercialId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (campaignId != null) r'campaignId': campaignId,
      if (enrollmentCapturedById != null)
        r'enrollmentCapturedById': enrollmentCapturedById,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (includeDeleted != null) r'includeDeleted': includeDeleted,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    NamedCountListDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<NamedCountListDto, NamedCountListDto>(
              rawData,
              'NamedCountListDto',
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

    return Response<NamedCountListDto>(
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

  /// Série temporelle des saisies, par jour, semaine ou mois.
  ///
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId]
  /// * [banqueId]
  /// * [syndicatId]
  /// * [departementId]
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [statut]
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [campaignId] - Campagne d’appels : ne retient que les prospects portant une tâche de cette campagne.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [includeDeleted] - Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  /// * [granularity]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [AnalyticsSeriesDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<AnalyticsSeriesDto>> getProspectsOverTime({
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? campaignId,
    String? enrollmentCapturedById,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted = false,
    TimeGranularity? granularity,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/analytics/prospects-over-time';
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
      if (representantId != null) r'representantId': representantId,
      if (banqueId != null) r'banqueId': banqueId,
      if (syndicatId != null) r'syndicatId': syndicatId,
      if (departementId != null) r'departementId': departementId,
      if (commercialId != null) r'commercialId': commercialId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (campaignId != null) r'campaignId': campaignId,
      if (enrollmentCapturedById != null)
        r'enrollmentCapturedById': enrollmentCapturedById,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (includeDeleted != null) r'includeDeleted': includeDeleted,
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

    AnalyticsSeriesDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<AnalyticsSeriesDto, AnalyticsSeriesDto>(
              rawData,
              'AnalyticsSeriesDto',
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

    return Response<AnalyticsSeriesDto>(
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

  /// Classement des commerciaux.
  ///
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId]
  /// * [banqueId]
  /// * [syndicatId]
  /// * [departementId]
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [statut]
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [campaignId] - Campagne d’appels : ne retient que les prospects portant une tâche de cette campagne.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [includeDeleted] - Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  /// * [limit]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [TopCommercialListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<TopCommercialListDto>> getTopCommercials({
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? campaignId,
    String? enrollmentCapturedById,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted = false,
    num? limit = 10,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/analytics/top-commercials';
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
      if (representantId != null) r'representantId': representantId,
      if (banqueId != null) r'banqueId': banqueId,
      if (syndicatId != null) r'syndicatId': syndicatId,
      if (departementId != null) r'departementId': departementId,
      if (commercialId != null) r'commercialId': commercialId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (campaignId != null) r'campaignId': campaignId,
      if (enrollmentCapturedById != null)
        r'enrollmentCapturedById': enrollmentCapturedById,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (includeDeleted != null) r'includeDeleted': includeDeleted,
      if (limit != null) r'limit': limit,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    TopCommercialListDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<TopCommercialListDto, TopCommercialListDto>(
              rawData,
              'TopCommercialListDto',
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

    return Response<TopCommercialListDto>(
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

  /// Représentants ayant apporté le plus de prospects.
  ///
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId]
  /// * [banqueId]
  /// * [syndicatId]
  /// * [departementId]
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [statut]
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [campaignId] - Campagne d’appels : ne retient que les prospects portant une tâche de cette campagne.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [includeDeleted] - Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  /// * [limit]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [TopRepresentantListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<TopRepresentantListDto>> getTopRepresentants({
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? campaignId,
    String? enrollmentCapturedById,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted = false,
    num? limit = 10,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/analytics/top-representants';
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
      if (representantId != null) r'representantId': representantId,
      if (banqueId != null) r'banqueId': banqueId,
      if (syndicatId != null) r'syndicatId': syndicatId,
      if (departementId != null) r'departementId': departementId,
      if (commercialId != null) r'commercialId': commercialId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (campaignId != null) r'campaignId': campaignId,
      if (enrollmentCapturedById != null)
        r'enrollmentCapturedById': enrollmentCapturedById,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (includeDeleted != null) r'includeDeleted': includeDeleted,
      if (limit != null) r'limit': limit,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    TopRepresentantListDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<TopRepresentantListDto, TopRepresentantListDto>(
              rawData,
              'TopRepresentantListDto',
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

    return Response<TopRepresentantListDto>(
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
