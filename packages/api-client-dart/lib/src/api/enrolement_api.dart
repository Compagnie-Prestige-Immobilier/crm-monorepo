//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

// ignore: unused_import
import 'dart:convert';
import 'package:crm_api_client/src/deserialize.dart';
import 'package:dio/dio.dart';

import 'package:crm_api_client/src/model/api_error_dto.dart';
import 'package:crm_api_client/src/model/enrolement_indicateurs_dto.dart';
import 'package:crm_api_client/src/model/enrolement_reglages_dto.dart';
import 'package:crm_api_client/src/model/inscription_plateforme_detail_dto.dart';
import 'package:crm_api_client/src/model/inscriptions_page_dto.dart';
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/tirage_dto.dart';
import 'package:crm_api_client/src/model/update_enrolement_reglages_dto.dart';

class EnrolementApi {
  final Dio _dio;

  const EnrolementApi(this._dio);

  /// Les indicateurs d’enrôlement du projet.
  ///
  ///
  /// Parameters:
  /// * [projet]
  /// * [page]
  /// * [pageSize]
  /// * [statut] - Statut distant, tel que la plateforme le rend.
  /// * [search] - Recherche libre sur le nom, l’e-mail ou le téléphone.
  /// * [dateFrom] - Borne basse sur la date d’inscription, incluse.
  /// * [dateTo] - Borne haute sur la date d’inscription, incluse.
  /// * [rapproche] - Vrai : seulement les inscriptions rapprochées d’un prospect. Faux : seulement celles qui ne le sont pas.
  /// * [inclureDisparues] - Vrai : montrer aussi les inscriptions que la plateforme ne rend plus. Absente, elles sont masquées.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [EnrolementIndicateursDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<EnrolementIndicateursDto>> getEnrolementIndicateurs({
    required Projet projet,
    num? page = 1,
    num? pageSize = 25,
    String? statut,
    String? search,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? rapproche,
    bool? inclureDisparues,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/enrolement/{projet}/indicateurs'.replaceAll(
      '{'
      r'projet'
      '}',
      projet.toString(),
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

    final _queryParameters = <String, dynamic>{
      if (page != null) r'page': page,
      if (pageSize != null) r'pageSize': pageSize,
      if (statut != null) r'statut': statut,
      if (search != null) r'search': search,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (rapproche != null) r'rapproche': rapproche,
      if (inclureDisparues != null) r'inclureDisparues': inclureDisparues,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    EnrolementIndicateursDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<EnrolementIndicateursDto, EnrolementIndicateursDto>(
              rawData,
              'EnrolementIndicateursDto',
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

    return Response<EnrolementIndicateursDto>(
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

  /// Une inscription, charge utile brute comprise.
  ///
  ///
  /// Parameters:
  /// * [projet]
  /// * [id]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [InscriptionPlateformeDetailDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<InscriptionPlateformeDetailDto>> getEnrolementInscription({
    required Projet projet,
    required String id,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/enrolement/{projet}/inscriptions/{id}'
        .replaceAll(
          '{'
          r'projet'
          '}',
          projet.toString(),
        )
        .replaceAll(
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

    InscriptionPlateformeDetailDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<
              InscriptionPlateformeDetailDto,
              InscriptionPlateformeDetailDto
            >(rawData, 'InscriptionPlateformeDetailDto', growable: true);
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<InscriptionPlateformeDetailDto>(
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

  /// Fréquence, date de reprise et compte rendu du dernier tirage.
  ///
  ///
  /// Parameters:
  /// * [projet]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [EnrolementReglagesDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<EnrolementReglagesDto>> getEnrolementReglages({
    required Projet projet,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/enrolement/{projet}/reglages'.replaceAll(
      '{'
      r'projet'
      '}',
      projet.toString(),
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

    EnrolementReglagesDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<EnrolementReglagesDto, EnrolementReglagesDto>(
              rawData,
              'EnrolementReglagesDto',
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

    return Response<EnrolementReglagesDto>(
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

  /// Les inscriptions lues sur la plateforme du projet.
  ///
  ///
  /// Parameters:
  /// * [projet]
  /// * [page]
  /// * [pageSize]
  /// * [statut] - Statut distant, tel que la plateforme le rend.
  /// * [search] - Recherche libre sur le nom, l’e-mail ou le téléphone.
  /// * [dateFrom] - Borne basse sur la date d’inscription, incluse.
  /// * [dateTo] - Borne haute sur la date d’inscription, incluse.
  /// * [rapproche] - Vrai : seulement les inscriptions rapprochées d’un prospect. Faux : seulement celles qui ne le sont pas.
  /// * [inclureDisparues] - Vrai : montrer aussi les inscriptions que la plateforme ne rend plus. Absente, elles sont masquées.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [InscriptionsPageDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<InscriptionsPageDto>> listEnrolementInscriptions({
    required Projet projet,
    num? page = 1,
    num? pageSize = 25,
    String? statut,
    String? search,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? rapproche,
    bool? inclureDisparues,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/enrolement/{projet}/inscriptions'.replaceAll(
      '{'
      r'projet'
      '}',
      projet.toString(),
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

    final _queryParameters = <String, dynamic>{
      if (page != null) r'page': page,
      if (pageSize != null) r'pageSize': pageSize,
      if (statut != null) r'statut': statut,
      if (search != null) r'search': search,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (rapproche != null) r'rapproche': rapproche,
      if (inclureDisparues != null) r'inclureDisparues': inclureDisparues,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    InscriptionsPageDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<InscriptionsPageDto, InscriptionsPageDto>(
              rawData,
              'InscriptionsPageDto',
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

    return Response<InscriptionsPageDto>(
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

  /// Tire la plateforme maintenant, sans attendre l’échéance.
  /// Le tirage est idempotent : une inscription déjà lue est mise à jour, jamais redéposée.
  ///
  /// Parameters:
  /// * [projet]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [TirageDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<TirageDto>> postEnrolementTirage({
    required Projet projet,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/enrolement/{projet}/tirage'.replaceAll(
      '{'
      r'projet'
      '}',
      projet.toString(),
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
      validateStatus: validateStatus,
    );

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    TirageDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<TirageDto, TirageDto>(
              rawData,
              'TirageDto',
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

    return Response<TirageDto>(
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

  /// Change la fréquence de tirage ou la date de reprise.
  ///
  ///
  /// Parameters:
  /// * [projet]
  /// * [updateEnrolementReglagesDto]
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [EnrolementReglagesDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<EnrolementReglagesDto>> putEnrolementReglages({
    required Projet projet,
    required UpdateEnrolementReglagesDto updateEnrolementReglagesDto,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/enrolement/{projet}/reglages'.replaceAll(
      '{'
      r'projet'
      '}',
      projet.toString(),
    );
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
      _bodyData = jsonEncode(updateEnrolementReglagesDto);
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

    EnrolementReglagesDto? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null
          ? null
          : deserialize<EnrolementReglagesDto, EnrolementReglagesDto>(
              rawData,
              'EnrolementReglagesDto',
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

    return Response<EnrolementReglagesDto>(
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
