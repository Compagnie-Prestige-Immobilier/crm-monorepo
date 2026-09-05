//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

// ignore: unused_import
import 'dart:convert';
import 'package:crm_api_client/src/deserialize.dart';
import 'package:dio/dio.dart';

import 'package:crm_api_client/src/model/ambassador_conversion_dto.dart';
import 'package:crm_api_client/src/model/analytics_delays_dto.dart';
import 'package:crm_api_client/src/model/analytics_funnel_dto.dart';
import 'package:crm_api_client/src/model/analytics_series_dto.dart';
import 'package:crm_api_client/src/model/analytics_totals_dto.dart';
import 'package:crm_api_client/src/model/api_error_dto.dart';
import 'package:crm_api_client/src/model/bank_aging_dto.dart';
import 'package:crm_api_client/src/model/bdd_segment.dart';
import 'package:crm_api_client/src/model/data_quality_dto.dart';
import 'package:crm_api_client/src/model/departement_yield_list_dto.dart';
import 'package:crm_api_client/src/model/enrollment_method.dart';
import 'package:crm_api_client/src/model/enrollment_method_list_dto.dart';
import 'package:crm_api_client/src/model/named_count_list_dto.dart';
import 'package:crm_api_client/src/model/origin_breakdown_dto.dart';
import 'package:crm_api_client/src/model/phase2_status.dart';
import 'package:crm_api_client/src/model/phase2_status_list_dto.dart';
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/prospect_statut.dart';
import 'package:crm_api_client/src/model/prospect_type.dart';
import 'package:crm_api_client/src/model/representant_productivity_list_dto.dart';
import 'package:crm_api_client/src/model/segment_conversion_list_dto.dart';
import 'package:crm_api_client/src/model/segment_list_dto.dart';
import 'package:crm_api_client/src/model/time_granularity.dart';
import 'package:crm_api_client/src/model/top_commercial_list_dto.dart';
import 'package:crm_api_client/src/model/top_representant_list_dto.dart';
import 'package:crm_api_client/src/model/weekly_cohort_list_dto.dart';

class AnalyticsApi {

  final Dio _dio;

  const AnalyticsApi(this._dio);

  /// Part des représentants travaillés devenus ambassadeurs.
  /// La période borne la DATE DE LA BASCULE, pas l’arrivée en base : un statut poussé avec trois jours de retard reste compté le jour où il a été décidé. Le dénominateur ne retient que les représentants dont la relation a bougé dans la période ; &#x60;untracked&#x60; compte, hors période, ceux de l’annuaire sans aucune trace, qui ne sont donc mesurés ni au numérateur ni au dénominateur. Seuls &#x60;dateFrom&#x60;, &#x60;dateTo&#x60;, &#x60;commercialId&#x60;, &#x60;departementId&#x60; et &#x60;representantId&#x60; agissent : les autres filtres qualifient un prospect, pas un représentant.
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId] 
  /// * [banqueId] 
  /// * [syndicatId] 
  /// * [departementId] 
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
  /// Returns a [Future] containing a [Response] with a [AmbassadorConversionDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<AmbassadorConversionDto>> getAmbassadorConversion({ 
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
    final _path = r'/api/v1/analytics/ambassador-conversion';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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

    AmbassadorConversionDto? _responseData;

    try {
final rawData = _response.data;
_responseData = rawData == null ? null : deserialize<AmbassadorConversionDto, AmbassadorConversionDto>(rawData, 'AmbassadorConversionDto', growable: true);

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<AmbassadorConversionDto>(
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

  /// Durées médianes de la chaîne, du prospect à l’encaissement.
  /// Médiane et neuvième décile, en jours, sur les trois tronçons. Le produit horodate déjà tout : personne ne lisait ces dates, alors qu’elles désignent l’étape qui traîne.
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId] 
  /// * [banqueId] 
  /// * [syndicatId] 
  /// * [departementId] 
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
  /// Returns a [Future] containing a [Response] with a [AnalyticsDelaysDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<AnalyticsDelaysDto>> getAnalyticsDelays({ 
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
    final _path = r'/api/v1/analytics/delays';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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

    AnalyticsDelaysDto? _responseData;

    try {
final rawData = _response.data;
_responseData = rawData == null ? null : deserialize<AnalyticsDelaysDto, AnalyticsDelaysDto>(rawData, 'AnalyticsDelaysDto', growable: true);

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<AnalyticsDelaysDto>(
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

  /// Entonnoir complet et montants encaissés.
  /// Du prospect saisi au dossier encaissé, plus les montants. Le tableau de bord montrait l’effort, prospects, représentants, téléconseillers, mais jamais le résultat. Une direction qui ne voit que le haut de l’entonnoir peut féliciter une équipe qui saisit beaucoup et ne convertit rien.
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId] 
  /// * [banqueId] 
  /// * [syndicatId] 
  /// * [departementId] 
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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
_responseData = rawData == null ? null : deserialize<AnalyticsFunnelDto, AnalyticsFunnelDto>(rawData, 'AnalyticsFunnelDto', growable: true);

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
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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
_responseData = rawData == null ? null : deserialize<AnalyticsTotalsDto, AnalyticsTotalsDto>(rawData, 'AnalyticsTotalsDto', growable: true);

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

  /// Vieillissement des dossiers bancaires, par tranche et par étape.
  /// Ne compte que les dossiers non supprimés stationnant à une étape NON TERMINALE : un dossier encaissé ou rejeté est sorti du portefeuille et son ancienneté ne se pilote plus.
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId] 
  /// * [banqueId] 
  /// * [syndicatId] 
  /// * [departementId] 
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
  /// Returns a [Future] containing a [Response] with a [BankAgingDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<BankAgingDto>> getBankAging({ 
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
    final _path = r'/api/v1/analytics/bank-aging';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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

    BankAgingDto? _responseData;

    try {
final rawData = _response.data;
_responseData = rawData == null ? null : deserialize<BankAgingDto, BankAgingDto>(rawData, 'BankAgingDto', growable: true);

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<BankAgingDto>(
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

  /// Part de numéros injoignables ou erronés, par représentant et par département.
  /// Se branche sur les issues d’appel UNREACHABLE et WRONG_NUMBER. Les deux listes comptent la même population de tentatives selon deux axes.
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId] 
  /// * [banqueId] 
  /// * [syndicatId] 
  /// * [departementId] 
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
  /// Returns a [Future] containing a [Response] with a [DataQualityDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<DataQualityDto>> getDataQuality({ 
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
    final _path = r'/api/v1/analytics/data-quality';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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

    DataQualityDto? _responseData;

    try {
final rawData = _response.data;
_responseData = rawData == null ? null : deserialize<DataQualityDto, DataQualityDto>(rawData, 'DataQualityDto', growable: true);

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<DataQualityDto>(
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

  /// Rendement par département : taux, et pas seulement volume.
  /// 
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId] 
  /// * [banqueId] 
  /// * [syndicatId] 
  /// * [departementId] 
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
  /// Returns a [Future] containing a [Response] with a [DepartementYieldListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<DepartementYieldListDto>> getDepartementYield({ 
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
    final _path = r'/api/v1/analytics/departement-yield';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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

    DepartementYieldListDto? _responseData;

    try {
final rawData = _response.data;
_responseData = rawData == null ? null : deserialize<DepartementYieldListDto, DepartementYieldListDto>(rawData, 'DepartementYieldListDto', growable: true);

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<DepartementYieldListDto>(
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

  /// Provenance des fiches, avec le détail lisible en second niveau.
  /// Une provenance absente n’est pas une provenance inconnue : c’est le chemin normal, la saisie terrain.
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId] 
  /// * [banqueId] 
  /// * [syndicatId] 
  /// * [departementId] 
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
  /// Returns a [Future] containing a [Response] with a [OriginBreakdownDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<OriginBreakdownDto>> getOriginBreakdown({ 
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
    final _path = r'/api/v1/analytics/origin-breakdown';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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

    OriginBreakdownDto? _responseData;

    try {
final rawData = _response.data;
_responseData = rawData == null ? null : deserialize<OriginBreakdownDto, OriginBreakdownDto>(rawData, 'OriginBreakdownDto', growable: true);

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<OriginBreakdownDto>(
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
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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
_responseData = rawData == null ? null : deserialize<NamedCountListDto, NamedCountListDto>(rawData, 'NamedCountListDto', growable: true);

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
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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
_responseData = rawData == null ? null : deserialize<NamedCountListDto, NamedCountListDto>(rawData, 'NamedCountListDto', growable: true);

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
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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
_responseData = rawData == null ? null : deserialize<EnrollmentMethodListDto, EnrollmentMethodListDto>(rawData, 'EnrollmentMethodListDto', growable: true);

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
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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
_responseData = rawData == null ? null : deserialize<Phase2StatusListDto, Phase2StatusListDto>(rawData, 'Phase2StatusListDto', growable: true);

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
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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
_responseData = rawData == null ? null : deserialize<SegmentListDto, SegmentListDto>(rawData, 'SegmentListDto', growable: true);

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
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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
_responseData = rawData == null ? null : deserialize<NamedCountListDto, NamedCountListDto>(rawData, 'NamedCountListDto', growable: true);

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
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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
_responseData = rawData == null ? null : deserialize<AnalyticsSeriesDto, AnalyticsSeriesDto>(rawData, 'AnalyticsSeriesDto', growable: true);

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

  /// Productivité des représentants, et repérage des dormants.
  /// Prospects apportés, taux de conversion, dernier apport. &#x60;dormantDays&#x60; fixe le silence à partir duquel un représentant est déclaré dormant (90 jours par défaut).
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId] 
  /// * [banqueId] 
  /// * [syndicatId] 
  /// * [departementId] 
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [includeDeleted] - Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  /// * [limit] 
  /// * [dormantDays] - Ancienneté, en jours, au delà de laquelle un représentant sans nouvel apport est déclaré dormant. Le seuil est un paramètre parce qu’il dépend du rythme de la zone : trois mois de silence n’ont pas le même sens partout.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [RepresentantProductivityListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<RepresentantProductivityListDto>> getRepresentantProductivity({ 
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted = false,
    num? limit = 10,
    num? dormantDays = 90,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/analytics/representant-productivity';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (includeDeleted != null) r'includeDeleted': includeDeleted,
      if (limit != null) r'limit': limit,
      if (dormantDays != null) r'dormantDays': dormantDays,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    RepresentantProductivityListDto? _responseData;

    try {
final rawData = _response.data;
_responseData = rawData == null ? null : deserialize<RepresentantProductivityListDto, RepresentantProductivityListDto>(rawData, 'RepresentantProductivityListDto', growable: true);

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<RepresentantProductivityListDto>(
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

  /// Bascules de segment : sur la période, par segment d’origine, et par auteur.
  /// Le segment n’étant pas stocké sur le prospect, une conversion ne laisse aucune trace en dehors de &#x60;SegmentChange&#x60;. Cette opération est donc la seule à pouvoir répondre « combien de BDD3 avons-nous fait basculer ce mois, et par qui ». Les deux décomptes portent sur toute la période filtrée, pas sur la page affichée.
  ///
  /// Parameters:
  /// * [dateFrom] - Borne basse sur la date de bascule, incluse. Une date nue vaut minuit à Dakar.
  /// * [dateTo] - Borne haute sur la date de bascule, incluse. Une date nue vaut 23:59:59 à Dakar.
  /// * [fromSegment] - Segment de DÉPART. « Combien de BDD3 avons-nous fait basculer. »
  /// * [toSegment] - Segment d’ARRIVÉE. « Combien de conversions vers BDD1. »
  /// * [changedById] - Auteur de la bascule. Réservé à l’ADMIN : un COMMERCIAL ne voit que les siennes.
  /// * [page] 
  /// * [pageSize] 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [SegmentConversionListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<SegmentConversionListDto>> getSegmentConversions({ 
    DateTime? dateFrom,
    DateTime? dateTo,
    BddSegment? fromSegment,
    BddSegment? toSegment,
    String? changedById,
    num? page = 1,
    num? pageSize = 25,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/analytics/segment-conversions';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
        ],
        ...?extra,
      },
      validateStatus: validateStatus,
    );

    final _queryParameters = <String, dynamic>{
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (fromSegment != null) r'fromSegment': fromSegment,
      if (toSegment != null) r'toSegment': toSegment,
      if (changedById != null) r'changedById': changedById,
      if (page != null) r'page': page,
      if (pageSize != null) r'pageSize': pageSize,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    SegmentConversionListDto? _responseData;

    try {
final rawData = _response.data;
_responseData = rawData == null ? null : deserialize<SegmentConversionListDto, SegmentConversionListDto>(rawData, 'SegmentConversionListDto', growable: true);

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<SegmentConversionListDto>(
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
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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
_responseData = rawData == null ? null : deserialize<TopCommercialListDto, TopCommercialListDto>(rawData, 'TopCommercialListDto', growable: true);

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
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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
_responseData = rawData == null ? null : deserialize<TopRepresentantListDto, TopRepresentantListDto>(rawData, 'TopRepresentantListDto', growable: true);

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

  /// Cohortes hebdomadaires d’entrée, suivies jusqu’à l’encaissement.
  /// La seule mesure qui distingue une amélioration réelle d’un effet de volume. La semaine est celle de la saisie terrain, pas de l’arrivée en base.
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur le nom, le prénom ou le téléphone.
  /// * [representantId] 
  /// * [banqueId] 
  /// * [syndicatId] 
  /// * [departementId] 
  /// * [commercialId] - Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  /// * [projet] - Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.
  /// * [type] - Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  /// * [canalProvenanceId] - Grand Public : canal de provenance.
  /// * [statut] 
  /// * [segment] - Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  /// * [phase2Status] - Avancement de la phase 2. Dimension indépendante de `statut`.
  /// * [enrollmentMethod] - Méthode d’enrôlement obtenue en phase 2.
  /// * [appelePar] - Téléconseiller ayant consigné au moins une tentative sur la fiche.
  /// * [lastCallById] - Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
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
  /// Returns a [Future] containing a [Response] with a [WeeklyCohortListDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<WeeklyCohortListDto>> getWeeklyCohorts({ 
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? lastCallById,
    String? enrollmentCapturedById,
    String? origin,
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
    final _path = r'/api/v1/analytics/weekly-cohorts';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (appelePar != null) r'appelePar': appelePar,
      if (lastCallById != null) r'lastCallById': lastCallById,
      if (enrollmentCapturedById != null) r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
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

    WeeklyCohortListDto? _responseData;

    try {
final rawData = _response.data;
_responseData = rawData == null ? null : deserialize<WeeklyCohortListDto, WeeklyCohortListDto>(rawData, 'WeeklyCohortListDto', growable: true);

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<WeeklyCohortListDto>(
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
