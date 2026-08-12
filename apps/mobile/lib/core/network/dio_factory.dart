import 'package:crm_api_client/crm_api_client.dart';
import 'package:dio/dio.dart';

import '../sync/token_store.dart';
import 'api_environment.dart';
import 'auth_interceptor.dart';
import 'refresh_mutex.dart';
import 'logging_interceptor.dart';
import 'request_id_interceptor.dart';
import 'retry_interceptor.dart';
import 'timeout_profile.dart';

/// Construit **l'unique** transport de l'application et le client généré qui
/// s'appuie dessus.
///
/// Le point capital est la dernière ligne : `CrmApiClient(dio: dio)`. Si on
/// laissait le client généré fabriquer son propre Dio — ce qu'il fait très bien
/// tout seul quand on ne lui en passe pas — il obtiendrait un transport sans
/// aucun de nos intercepteurs : pas d'`Authorization`, pas de renouvellement,
/// pas d'identifiant de requête, et des délais d'attente de 5 s/3 s. Toutes les
/// requêtes partiraient en 401 et la panne serait incompréhensible, parce que le
/// code aurait *l'air* correct.
///
/// **Ordre des intercepteurs.** Dio les exécute dans l'ordre d'ajout à l'aller
/// et dans l'ordre inverse au retour.
///
/// 1. [TimeoutProfileInterceptor] — ajuste le délai avant que quoi que ce soit
///    d'autre ne parte ; le client généré n'expose pas de paramètre de délai.
/// 2. [RequestIdInterceptor] — l'identifiant doit exister avant la première
///    erreur possible, sinon il manque précisément aux requêtes à déboguer.
/// 3. [AuthInterceptor] — pose le porteur, renouvelle en vol unique, rejoue sur
///    un Dio nu.
/// 4. [RetryInterceptor] — **GET seulement** ; après l'authentification, pour
///    qu'un rejeu de 401 ne soit pas compté comme un réessai réseau.
/// 5. [LoggingInterceptor] — dernier, pour journaliser ce qui part réellement.
class ApiClientFactory {
  const ApiClientFactory._();

  static ({Dio dio, CrmApiClient client}) build({
    required TokenStore tokens,
    String baseUrl = ApiEnvironment.baseUrl,
    bool verboseLogs = false,
    void Function()? onSessionExpired,
    RefreshMutex mutex = const NoRefreshMutex(),
  }) {
    final BaseOptions options = BaseOptions(
      baseUrl: baseUrl,
      // 2G/3G. Voir TimeoutProfile pour le raisonnement complet.
      connectTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 30),
      receiveTimeout: TimeoutProfile.read.receive,
      // Le client généré déballe lui-même les codes d'erreur : on le laisse voir
      // les réponses 4xx/5xx plutôt que de les convertir en exception muette.
      headers: <String, dynamic>{'Accept': 'application/json'},
    );

    final Dio dio = Dio(options);

    // Dio NU pour le rejeu et pour le renouvellement. Sans intercepteur
    // d'authentification : rejouer à travers la chaîne interceptée boucle à
    // l'infini sur un jeton durablement refusé.
    final Dio bare = Dio(options.copyWith());
    bare.interceptors.add(const TimeoutProfileInterceptor());

    final AuthApi refreshApi = AuthApi(bare);

    dio.interceptors.addAll(<Interceptor>[
      const TimeoutProfileInterceptor(),
      const RequestIdInterceptor(),
      AuthInterceptor(
        tokens: tokens,
        replayDio: bare,
        onSessionExpired: onSessionExpired,
        mutex: mutex,
        refreshCall: (String refreshToken) async {
          final Response<AuthTokensDto> response = await refreshApi.refreshSession(
            userAgent: ApiEnvironment.userAgent,
            refreshDto: RefreshDto(refreshToken: refreshToken),
            extra: <String, dynamic>{
              AuthInterceptor.noAuthFlag: true,
              ...TimeoutProfile.read.extra,
            },
          );
          final AuthTokensDto body = response.data!;
          return RefreshedTokens(
            accessToken: body.accessToken,
            refreshToken: body.refreshToken,
          );
        },
      ),
      RetryInterceptor(),
      LoggingInterceptor(enabled: verboseLogs),
    ]);

    // `interceptors: []` et non l'omission : sans ce paramètre, le constructeur
    // généré AJOUTE ses quatre intercepteurs d'authentification (OAuth, Basic,
    // Bearer, ApiKey) à l'instance qu'on lui passe. Le sien poserait un second
    // en-tête `Authorization` à partir d'un registre de jetons qu'on ne
    // remplit jamais, et écraserait le porteur que [AuthInterceptor] vient de
    // poser. Une liste vide dit explicitement : l'authentification est à nous.
    return (
      dio: dio,
      client: CrmApiClient(dio: dio, interceptors: const <Interceptor>[]),
    );
  }
}
