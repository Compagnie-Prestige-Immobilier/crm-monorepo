//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

// ignore: unused_import
import 'dart:convert';
import 'package:crm_api_client/src/deserialize.dart';
import 'package:dio/dio.dart';

import 'package:crm_api_client/src/model/api_error_dto.dart';
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/stock_representants_dto.dart';
import 'package:crm_api_client/src/model/supervision_activity_dto.dart';
import 'package:crm_api_client/src/model/supervision_campagnes_dto.dart';
import 'package:crm_api_client/src/model/supervision_granularity.dart';
import 'package:crm_api_client/src/model/update_work_shifts_dto.dart';
import 'package:crm_api_client/src/model/work_shifts_dto.dart';

class SupervisionApi {
  final Dio _dio;

  const SupervisionApi(this._dio);

  /// Activité des téléconseillers sur la fenêtre demandée.
  /// La fenêtre porte sur la date de l’ACTE, pas sur celle de la fiche : un téléconseiller resté hors ligne trois semaines verrait sinon ses appels du lundi comptés le jeudi de la synchronisation. Les lignes n’existent qu’aux périodes où il s’est passé quelque chose ; &#x60;teleconseillers&#x60; porte la liste complète et le reste à faire, qu’aucune date ne borne.
  ///
  /// Parameters:
  /// * [actFrom] - Borne basse sur la date de l’ACTE, incluse : heure d’appel, de saisie ou de clôture relevée chez le client, et non date d’arrivée en base. Une date seule (AAAA-MM-JJ) démarre à minuit, fuseau Africa/Dakar.
  /// * [actTo] - Borne haute sur la date de l’acte, incluse. Une date seule finit à 23:59:59.999.
  /// * [granularity]
  /// * [projet] - Le projet. ABSENT veut dire les deux. Un représentant n’existe que dans CHUES : sous `GRAND_PUBLIC`, toutes les colonnes `rep*` valent 0 ou `null`.
  /// * [commercialId] - Un seul téléconseiller : borne les lignes, la liste et les histogrammes.
  /// * [timeFrom] - Heure de début quotidienne, Dakar.
  /// * [timeTo] - Heure de fin quotidienne, exclue.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [SupervisionActivityDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<SupervisionActivityDto>> getSupervisionActivite({
    DateTime? actFrom,
    DateTime? actTo,
    SupervisionGranularity? granularity,
    Projet? projet,
    String? commercialId,
    String? timeFrom,
    String? timeTo,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/supervision/activite';
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
      if (actFrom != null) r'actFrom': actFrom,
      if (actTo != null) r'actTo': actTo,
      if (granularity != null) r'granularity': granularity,
      if (projet != null) r'projet': projet,
      if (commercialId != null) r'commercialId': commercialId,
      if (timeFrom != null) r'timeFrom': timeFrom,
      if (timeTo != null) r'timeTo': timeTo,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    SupervisionActivityDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<SupervisionActivityDto, SupervisionActivityDto>(
              rawData,
              'SupervisionActivityDto',
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

    return Response<SupervisionActivityDto>(
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

  /// Taux de contact et d’exploitation des campagnes de la fenêtre.
  /// Une campagne entre dans la fenêtre par ses jours de programme. &#x60;granularity&#x60;, &#x60;timeFrom&#x60; et &#x60;timeTo&#x60; sont ignorés.
  ///
  /// Parameters:
  /// * [actFrom] - Borne basse sur la date de l’ACTE, incluse : heure d’appel, de saisie ou de clôture relevée chez le client, et non date d’arrivée en base. Une date seule (AAAA-MM-JJ) démarre à minuit, fuseau Africa/Dakar.
  /// * [actTo] - Borne haute sur la date de l’acte, incluse. Une date seule finit à 23:59:59.999.
  /// * [granularity]
  /// * [projet] - Le projet. ABSENT veut dire les deux. Un représentant n’existe que dans CHUES : sous `GRAND_PUBLIC`, toutes les colonnes `rep*` valent 0 ou `null`.
  /// * [commercialId] - Un seul téléconseiller : borne les lignes, la liste et les histogrammes.
  /// * [timeFrom] - Heure de début quotidienne, Dakar.
  /// * [timeTo] - Heure de fin quotidienne, exclue.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [SupervisionCampagnesDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<SupervisionCampagnesDto>> getSupervisionCampagnes({
    DateTime? actFrom,
    DateTime? actTo,
    SupervisionGranularity? granularity,
    Projet? projet,
    String? commercialId,
    String? timeFrom,
    String? timeTo,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/supervision/campagnes';
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
      if (actFrom != null) r'actFrom': actFrom,
      if (actTo != null) r'actTo': actTo,
      if (granularity != null) r'granularity': granularity,
      if (projet != null) r'projet': projet,
      if (commercialId != null) r'commercialId': commercialId,
      if (timeFrom != null) r'timeFrom': timeFrom,
      if (timeTo != null) r'timeTo': timeTo,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    SupervisionCampagnesDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<SupervisionCampagnesDto, SupervisionCampagnesDto>(
              rawData,
              'SupervisionCampagnesDto',
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

    return Response<SupervisionCampagnesDto>(
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

  /// Créneaux de travail suivis.
  ///
  ///
  /// Parameters:
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [WorkShiftsDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<WorkShiftsDto>> getSupervisionCreneaux({
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/supervision/creneaux';
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

    WorkShiftsDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<WorkShiftsDto, WorkShiftsDto>(
              rawData,
              'WorkShiftsDto',
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

    return Response<WorkShiftsDto>(
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

  /// Le stock des représentants : total, par département, par IEF, jamais appelés, injoignables.
  ///
  ///
  /// Parameters:
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [StockRepresentantsDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<StockRepresentantsDto>> getSupervisionRepresentants({
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/supervision/representants';
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

    StockRepresentantsDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<StockRepresentantsDto, StockRepresentantsDto>(
              rawData,
              'StockRepresentantsDto',
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

    return Response<StockRepresentantsDto>(
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

  /// Modifie les créneaux de travail.
  ///
  ///
  /// Parameters:
  /// * [updateWorkShiftsDto]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [WorkShiftsDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<WorkShiftsDto>> updateSupervisionCreneaux({
    required UpdateWorkShiftsDto updateWorkShiftsDto,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/supervision/creneaux';
    final _options = Options(
      method: r'PUT',
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
      _bodyData = jsonEncode(updateWorkShiftsDto);
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

    WorkShiftsDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<WorkShiftsDto, WorkShiftsDto>(
              rawData,
              'WorkShiftsDto',
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

    return Response<WorkShiftsDto>(
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
