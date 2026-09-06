//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'package:dio/dio.dart';
import 'package:crm_api_client/src/auth/api_key_auth.dart';
import 'package:crm_api_client/src/auth/basic_auth.dart';
import 'package:crm_api_client/src/auth/bearer_auth.dart';
import 'package:crm_api_client/src/auth/oauth.dart';
import 'package:crm_api_client/src/api/admin_api.dart';
import 'package:crm_api_client/src/api/analytics_api.dart';
import 'package:crm_api_client/src/api/app_updates_api.dart';
import 'package:crm_api_client/src/api/auth_api.dart';
import 'package:crm_api_client/src/api/bank_case_stages_api.dart';
import 'package:crm_api_client/src/api/bank_cases_api.dart';
import 'package:crm_api_client/src/api/call_outcome_reasons_api.dart';
import 'package:crm_api_client/src/api/champs_conversion_api.dart';
import 'package:crm_api_client/src/api/client_requests_api.dart';
import 'package:crm_api_client/src/api/demo_api.dart';
import 'package:crm_api_client/src/api/enrolement_api.dart';
import 'package:crm_api_client/src/api/export_api.dart';
import 'package:crm_api_client/src/api/imports_api.dart';
import 'package:crm_api_client/src/api/lots_export_api.dart';
import 'package:crm_api_client/src/api/notification_templates_api.dart';
import 'package:crm_api_client/src/api/notifications_api.dart';
import 'package:crm_api_client/src/api/ouvertures_api.dart';
import 'package:crm_api_client/src/api/phase2_api.dart';
import 'package:crm_api_client/src/api/prospects_api.dart';
import 'package:crm_api_client/src/api/referentiels_api.dart';
import 'package:crm_api_client/src/api/rep_campaigns_api.dart';
import 'package:crm_api_client/src/api/representants_api.dart';
import 'package:crm_api_client/src/api/statuts_qualification_api.dart';
import 'package:crm_api_client/src/api/suggestions_api.dart';
import 'package:crm_api_client/src/api/supervision_api.dart';
import 'package:crm_api_client/src/api/sync_api.dart';
import 'package:crm_api_client/src/api/tableaux_de_bord_api.dart';
import 'package:crm_api_client/src/api/users_api.dart';
import 'package:crm_api_client/src/api/visites_api.dart';

class CrmApiClient {
  static const String basePath = r'http://localhost';

  final Dio dio;
  CrmApiClient({
    Dio? dio,
    String? basePathOverride,
    List<Interceptor>? interceptors,
  }) : this.dio =
           dio ??
           Dio(
             BaseOptions(
               baseUrl: basePathOverride ?? basePath,
               connectTimeout: const Duration(milliseconds: 5000),
               receiveTimeout: const Duration(milliseconds: 3000),
             ),
           ) {
    if (interceptors == null) {
      this.dio.interceptors.addAll([
        OAuthInterceptor(),
        BasicAuthInterceptor(),
        BearerAuthInterceptor(),
        ApiKeyAuthInterceptor(),
      ]);
    } else {
      this.dio.interceptors.addAll(interceptors);
    }
  }

  void setOAuthToken(String name, String token) {
    if (this.dio.interceptors.any((i) => i is OAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((i) => i is OAuthInterceptor)
                  as OAuthInterceptor)
              .tokens[name] =
          token;
    }
  }

  /// Removes the OAuth token associated with the given [name].
  ///
  /// If no [OAuthInterceptor] is registered or no token exists for the given
  /// [name], this method has no effect.
  void removeOAuthToken(String name) {
    if (this.dio.interceptors.any((i) => i is OAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((i) => i is OAuthInterceptor)
              as OAuthInterceptor)
          .tokens
          .remove(name);
    }
  }

  void setBearerAuth(String name, String token) {
    if (this.dio.interceptors.any((i) => i is BearerAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((i) => i is BearerAuthInterceptor)
                  as BearerAuthInterceptor)
              .tokens[name] =
          token;
    }
  }

  /// Removes the bearer authentication token associated with the given [name].
  ///
  /// If no [BearerAuthInterceptor] is registered or no token exists for the
  /// given [name], this method has no effect.
  void removeBearerAuth(String name) {
    if (this.dio.interceptors.any((i) => i is BearerAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((i) => i is BearerAuthInterceptor)
              as BearerAuthInterceptor)
          .tokens
          .remove(name);
    }
  }

  void setBasicAuth(String name, String username, String password) {
    if (this.dio.interceptors.any((i) => i is BasicAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((i) => i is BasicAuthInterceptor)
              as BasicAuthInterceptor)
          .authInfo[name] = BasicAuthInfo(
        username,
        password,
      );
    }
  }

  /// Removes the basic authentication credentials associated with the given [name].
  ///
  /// If no [BasicAuthInterceptor] is registered or no credentials exist for the
  /// given [name], this method has no effect.
  void removeBasicAuth(String name) {
    if (this.dio.interceptors.any((i) => i is BasicAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((i) => i is BasicAuthInterceptor)
              as BasicAuthInterceptor)
          .authInfo
          .remove(name);
    }
  }

  void setApiKey(String name, String apiKey) {
    if (this.dio.interceptors.any((i) => i is ApiKeyAuthInterceptor)) {
      (this.dio.interceptors.firstWhere(
                    (element) => element is ApiKeyAuthInterceptor,
                  )
                  as ApiKeyAuthInterceptor)
              .apiKeys[name] =
          apiKey;
    }
  }

  /// Removes the API key associated with the given [name].
  ///
  /// If no [ApiKeyAuthInterceptor] is registered or no API key exists for the
  /// given [name], this method has no effect.
  void removeApiKey(String name) {
    if (this.dio.interceptors.any((i) => i is ApiKeyAuthInterceptor)) {
      (this.dio.interceptors.firstWhere(
                (element) => element is ApiKeyAuthInterceptor,
              )
              as ApiKeyAuthInterceptor)
          .apiKeys
          .remove(name);
    }
  }

  /// Get AdminApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AdminApi getAdminApi() {
    return AdminApi(dio);
  }

  /// Get AnalyticsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AnalyticsApi getAnalyticsApi() {
    return AnalyticsApi(dio);
  }

  /// Get AppUpdatesApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AppUpdatesApi getAppUpdatesApi() {
    return AppUpdatesApi(dio);
  }

  /// Get AuthApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AuthApi getAuthApi() {
    return AuthApi(dio);
  }

  /// Get BankCaseStagesApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  BankCaseStagesApi getBankCaseStagesApi() {
    return BankCaseStagesApi(dio);
  }

  /// Get BankCasesApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  BankCasesApi getBankCasesApi() {
    return BankCasesApi(dio);
  }

  /// Get CallOutcomeReasonsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  CallOutcomeReasonsApi getCallOutcomeReasonsApi() {
    return CallOutcomeReasonsApi(dio);
  }

  /// Get ChampsConversionApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  ChampsConversionApi getChampsConversionApi() {
    return ChampsConversionApi(dio);
  }

  /// Get ClientRequestsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  ClientRequestsApi getClientRequestsApi() {
    return ClientRequestsApi(dio);
  }

  /// Get DemoApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  DemoApi getDemoApi() {
    return DemoApi(dio);
  }

  /// Get EnrolementApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  EnrolementApi getEnrolementApi() {
    return EnrolementApi(dio);
  }

  /// Get ExportApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  ExportApi getExportApi() {
    return ExportApi(dio);
  }

  /// Get ImportsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  ImportsApi getImportsApi() {
    return ImportsApi(dio);
  }

  /// Get LotsExportApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  LotsExportApi getLotsExportApi() {
    return LotsExportApi(dio);
  }

  /// Get NotificationTemplatesApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  NotificationTemplatesApi getNotificationTemplatesApi() {
    return NotificationTemplatesApi(dio);
  }

  /// Get NotificationsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  NotificationsApi getNotificationsApi() {
    return NotificationsApi(dio);
  }

  /// Get OuverturesApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  OuverturesApi getOuverturesApi() {
    return OuverturesApi(dio);
  }

  /// Get Phase2Api instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  Phase2Api getPhase2Api() {
    return Phase2Api(dio);
  }

  /// Get ProspectsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  ProspectsApi getProspectsApi() {
    return ProspectsApi(dio);
  }

  /// Get ReferentielsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  ReferentielsApi getReferentielsApi() {
    return ReferentielsApi(dio);
  }

  /// Get RepCampaignsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  RepCampaignsApi getRepCampaignsApi() {
    return RepCampaignsApi(dio);
  }

  /// Get RepresentantsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  RepresentantsApi getRepresentantsApi() {
    return RepresentantsApi(dio);
  }

  /// Get StatutsQualificationApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  StatutsQualificationApi getStatutsQualificationApi() {
    return StatutsQualificationApi(dio);
  }

  /// Get SuggestionsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  SuggestionsApi getSuggestionsApi() {
    return SuggestionsApi(dio);
  }

  /// Get SupervisionApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  SupervisionApi getSupervisionApi() {
    return SupervisionApi(dio);
  }

  /// Get SyncApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  SyncApi getSyncApi() {
    return SyncApi(dio);
  }

  /// Get TableauxDeBordApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  TableauxDeBordApi getTableauxDeBordApi() {
    return TableauxDeBordApi(dio);
  }

  /// Get UsersApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  UsersApi getUsersApi() {
    return UsersApi(dio);
  }

  /// Get VisitesApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  VisitesApi getVisitesApi() {
    return VisitesApi(dio);
  }
}
