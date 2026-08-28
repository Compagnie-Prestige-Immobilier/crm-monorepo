//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

// ignore: unused_import
import 'dart:convert';
import 'package:crm_api_client/src/deserialize.dart';
import 'package:dio/dio.dart';

import 'dart:typed_data';
import 'package:crm_api_client/src/model/api_error_dto.dart';
import 'package:crm_api_client/src/model/bank_stage_type.dart';
import 'package:crm_api_client/src/model/bdd_segment.dart';
import 'package:crm_api_client/src/model/enrollment_method.dart';
import 'package:crm_api_client/src/model/export_mode.dart';
import 'package:crm_api_client/src/model/phase2_status.dart';
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/prospect_statut.dart';
import 'package:crm_api_client/src/model/prospect_type.dart';

class ExportApi {
  final Dio _dio;

  const ExportApi(this._dio);

  /// Modèle vide pour l’import de prospects Grand Public.
  /// Syndicat, banque de domiciliation, fonctionnaire et canal de provenance sont des listes déroulantes, tirées des référentiels VIVANTS. Seuls le nom et le téléphone sont exigés : toute autre colonne peut rester vide, ou même manquer du fichier, car les colonnes sont retrouvées par le texte de leur en-tête et non par leur rang.
  ///
  /// Parameters:
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [Uint8List] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<Uint8List>> downloadProspectsGrandPublicTemplateXlsx({
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/export/prospects-grand-public-modele.xlsx';
    final _options = Options(
      method: r'GET',
      responseType: ResponseType.bytes,
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

    Uint8List? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null ? null : rawData as Uint8List;
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<Uint8List>(
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

  /// Modèle vide pour l’import de prospects.
  /// En-têtes figés, une ligne d’exemple grisée, un onglet Instructions, et des listes déroulantes alimentées depuis les référentiels VIVANTS. Banque et Syndicat sont des listes et non du texte libre : leur croisement détermine le segment BDD, et une valeur saisie à la main range la fiche dans le mauvais segment.
  ///
  /// Parameters:
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [Uint8List] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<Uint8List>> downloadProspectsTemplateXlsx({
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/export/prospects-modele.xlsx';
    final _options = Options(
      method: r'GET',
      responseType: ResponseType.bytes,
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

    Uint8List? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null ? null : rawData as Uint8List;
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<Uint8List>(
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

  /// Modèle vide pour l’import de représentants.
  /// En-têtes figés, une ligne d’exemple grisée, un onglet Instructions, et des listes déroulantes alimentées depuis les référentiels VIVANTS : un département désactivé ce matin ne figure pas dans le modèle téléchargé cet après-midi.
  ///
  /// Parameters:
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [Uint8List] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<Uint8List>> downloadRepresentantsTemplateXlsx({
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/export/representants-modele.xlsx';
    final _options = Options(
      method: r'GET',
      responseType: ResponseType.bytes,
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

    Uint8List? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null ? null : rawData as Uint8List;
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<Uint8List>(
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

  /// Export Excel des dossiers bancaires, avec le filtre de la liste.
  /// Trois feuilles : Dossiers (une ligne par dossier filtré), Historique (toutes les transitions de ces dossiers) et Synthèse (les mêmes agrégats que le tableau de bord).
  ///
  /// Parameters:
  /// * [search] - Recherche libre sur la référence, le nom du client ou son téléphone.
  /// * [stageId]
  /// * [stageType]
  /// * [banqueId] - Banque de traitement du dossier.
  /// * [agentId] - Agent créateur OU dernier intervenant sur le dossier.
  /// * [rejectionReasonId]
  /// * [dateFrom] - Borne basse sur la création, incluse.
  /// * [dateTo] - Borne haute sur la création, incluse.
  /// * [amountMin] - Borne basse de montant. Montant en francs CFA, entier, exposé en chaîne. XOF n’a pas de décimales et un nombre JSON perdrait de la précision au-delà de 2^53.
  /// * [amountMax] - Borne haute de montant. Montant en francs CFA, entier, exposé en chaîne. XOF n’a pas de décimales et un nombre JSON perdrait de la précision au-delà de 2^53.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [Uint8List] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<Uint8List>> exportBankCasesXlsx({
    String? search,
    String? stageId,
    BankStageType? stageType,
    String? banqueId,
    String? agentId,
    String? rejectionReasonId,
    DateTime? dateFrom,
    DateTime? dateTo,
    String? amountMin,
    String? amountMax,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/export/bank-cases.xlsx';
    final _options = Options(
      method: r'GET',
      responseType: ResponseType.bytes,
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
      if (agentId != null) r'agentId': agentId,
      if (rejectionReasonId != null) r'rejectionReasonId': rejectionReasonId,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (amountMin != null) r'amountMin': amountMin,
      if (amountMax != null) r'amountMax': amountMax,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    Uint8List? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null ? null : rawData as Uint8List;
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<Uint8List>(
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

  /// Export Excel des prospects, avec le même filtre que la liste.
  /// Deux modes. &#x60;filtered&#x60; (défaut) : une feuille Prospects correspondant exactement aux filtres, plus Représentants et Synthèse. &#x60;consolidated&#x60; : exactement cinq feuilles, Consolidé, BDD1, BDD2, BDD3, BDD4.
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
  /// * [campaignId] - Campagne d’appels : ne retient que les prospects portant une tâche de cette campagne.
  /// * [assignedToId] - Téléconseiller à qui la tâche d’appel est ATTRIBUÉE. À ne pas confondre avec `commercialId`, auteur de la saisie de la fiche : sans ce filtre, un ADMIN qui demande une campagne reçoit toute la campagne au lieu de la file d’un seul agent.
  /// * [enrollmentCapturedById] - Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  /// * [origin] - Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [includeDeleted] - Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  /// * [mode] - `filtered` : une feuille correspondant aux filtres. `consolidated` : cinq feuilles (Consolidé, BDD1…BDD4) ; le paramètre `segment` y est sans effet, puisque c’est le classeur lui-même qui porte la segmentation.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [Uint8List] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<Uint8List>> exportProspectsXlsx({
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
    String? campaignId,
    String? assignedToId,
    String? enrollmentCapturedById,
    String? origin,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted = false,
    ExportMode? mode,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/export/prospects.xlsx';
    final _options = Options(
      method: r'GET',
      responseType: ResponseType.bytes,
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
      if (projet != null) r'projet': projet,
      if (type != null) r'type': type,
      if (canalProvenanceId != null) r'canalProvenanceId': canalProvenanceId,
      if (statut != null) r'statut': statut,
      if (segment != null) r'segment': segment,
      if (phase2Status != null) r'phase2Status': phase2Status,
      if (enrollmentMethod != null) r'enrollmentMethod': enrollmentMethod,
      if (campaignId != null) r'campaignId': campaignId,
      if (assignedToId != null) r'assignedToId': assignedToId,
      if (enrollmentCapturedById != null)
        r'enrollmentCapturedById': enrollmentCapturedById,
      if (origin != null) r'origin': origin,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (includeDeleted != null) r'includeDeleted': includeDeleted,
      if (mode != null) r'mode': mode,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    Uint8List? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null ? null : rawData as Uint8List;
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<Uint8List>(
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

  /// Export Excel des représentants, avec le même filtre que la liste.
  /// Mêmes critères que &#x60;GET /representants&#x60; : ce qui est exporté est exactement ce qui est affiché, cloisonnement par commercial compris.
  ///
  /// Parameters:
  /// * [search]
  /// * [departementId]
  /// * [iefId] - Filtre par IEF.
  /// * [commercialId] - Réservé à l’ADMIN.
  /// * [dateFrom] - Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [dateTo] - Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  /// * [hasProspects] - true : au moins un prospect vivant. false : aucun (représentant dormant).
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [Uint8List] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<Uint8List>> exportRepresentantsXlsx({
    String? search,
    String? departementId,
    String? iefId,
    String? commercialId,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? hasProspects,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/export/representants.xlsx';
    final _options = Options(
      method: r'GET',
      responseType: ResponseType.bytes,
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
      if (departementId != null) r'departementId': departementId,
      if (iefId != null) r'iefId': iefId,
      if (commercialId != null) r'commercialId': commercialId,
      if (dateFrom != null) r'dateFrom': dateFrom,
      if (dateTo != null) r'dateTo': dateTo,
      if (hasProspects != null) r'hasProspects': hasProspects,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    Uint8List? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null ? null : rawData as Uint8List;
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<Uint8List>(
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

  /// Export Excel du registre des visites, avec le même filtre que l’écran.
  /// Une feuille « Registre », onze colonnes, &#x60;N° REGISTRE&#x60; en tête. Conçu pour revenir : déposé sur &#x60;POST /v1/visites/import&#x60;, l’aller-retour détecte les différences ligne par ligne avant de les appliquer.
  ///
  /// Parameters:
  /// * [from]
  /// * [to]
  /// * [entrepriseId]
  /// * [directionId]
  /// * [destinataireId]
  /// * [objetId]
  /// * [search] - Nom du visiteur, ou référence du registre.
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [Uint8List] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<Uint8List>> exportVisitesXlsx({
    String? from,
    String? to,
    String? entrepriseId,
    String? directionId,
    String? destinataireId,
    String? objetId,
    String? search,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/api/v1/export/visites.xlsx';
    final _options = Options(
      method: r'GET',
      responseType: ResponseType.bytes,
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
      if (from != null) r'from': from,
      if (to != null) r'to': to,
      if (entrepriseId != null) r'entrepriseId': entrepriseId,
      if (directionId != null) r'directionId': directionId,
      if (destinataireId != null) r'destinataireId': destinataireId,
      if (objetId != null) r'objetId': objetId,
      if (search != null) r'search': search,
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    Uint8List? _responseData;

    try {
      final rawData = _response.data;
      _responseData = rawData == null ? null : rawData as Uint8List;
    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<Uint8List>(
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
