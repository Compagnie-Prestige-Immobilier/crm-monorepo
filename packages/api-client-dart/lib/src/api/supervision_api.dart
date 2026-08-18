//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

// ignore: unused_import
import 'dart:convert';
import 'package:crm_api_client/src/deserialize.dart';
import 'package:dio/dio.dart';

import 'package:crm_api_client/src/model/api_error_dto.dart';
import 'package:crm_api_client/src/model/supervision_activity_dto.dart';
import 'package:crm_api_client/src/model/supervision_granularity.dart';

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
}
