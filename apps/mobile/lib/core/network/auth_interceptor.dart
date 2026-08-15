import 'dart:async';

import 'package:dio/dio.dart';

import '../sync/token_store.dart';
import 'refresh_mutex.dart';
import 'session_expired.dart';

/// Jeton renouvelé, tel que le rend [AuthInterceptor.refreshCall].
class RefreshedTokens {
  const RefreshedTokens({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;
}

/// Authentification : pose le porteur, renouvelle en vol unique, rejoue une fois.
///
/// Trois pièges de ce motif, tous évités ici volontairement.
///
/// **1. Le renouvellement doit être en vol unique : et le vol unique ne suffit
/// pas.** Cinq requêtes parties ensemble reviennent en 401 ensemble. Sans
/// garde, cinq renouvellements concurrents partent ; le serveur révoque la
/// famille de jetons au premier rejeu détecté (`/auth/refresh` révoque le jeton
/// présenté) et déconnecte l'utilisateur alors que tout allait bien. Le champ
/// [_inFlight] porte ce vol unique : le premier 401 lance l'appel, les quatre
/// autres attendent le même `Future`.
///
/// Mais [_inFlight] est un champ d'instance, donc **par isolat**, alors que le
/// jeton de renouvellement, lui, est persisté et partagé. L'isolat WorkManager
/// construit son propre transport, donc son propre vol unique : au réveil du
/// worker pendant un démarrage d'app, les deux isolats présentaient le même
/// jeton à quelques millisecondes d'intervalle et le serveur révoquait la
/// famille. [_mutex] ferme cette course-là ; les deux gardes sont nécessaires et
/// couvrent des portées différentes.
///
/// **2. Le rejeu passe par un Dio NU.** Rejouer à travers l'instance
/// interceptée réinjecte la requête dans cette même chaîne : un second 401
/// relance un renouvellement, qui rejoue, qui 401… C'est le bug le plus
/// fréquent des intercepteurs JWT en Flutter, et il ne se voit qu'en production,
/// sous la forme d'une boucle qui vide la batterie. [_replay] n'a aucun
/// intercepteur d'authentification, donc aucune récursion possible.
///
/// **3. Un échec de renouvellement est terminal, pas retentable.** On efface les
/// jetons et on fait échouer *toutes* les requêtes en attente avec un
/// [SessionExpired] typé. Les laisser en erreur réseau générique ferait croire à
/// l'UI qu'un réessai plus tard suffirait, alors que la session est morte.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required TokenStore tokens,
    required Dio replayDio,
    required Future<RefreshedTokens> Function(String refreshToken) refreshCall,
    void Function()? onSessionExpired,
    RefreshMutex mutex = const NoRefreshMutex(),
  }) : _tokens = tokens,
       _replay = replayDio,
       _refreshCall = refreshCall,
       _onSessionExpired = onSessionExpired,
       _mutex = mutex;

  /// Marqueur posé sur les requêtes qui ne doivent PAS porter de porteur :
  /// `/auth/login` et `/auth/refresh`. Sans lui, un jeton d'accès périmé
  /// accompagnerait la requête de renouvellement et la ferait rejeter.
  static const String noAuthFlag = 'cpi.noAuth';

  /// Marqueur de rejeu. Une requête déjà rejouée qui 401 à nouveau est un vrai
  /// refus, pas un jeton périmé : on la laisse échouer.
  static const String replayedFlag = 'cpi.replayed';

  final TokenStore _tokens;
  final Dio _replay;
  final Future<RefreshedTokens> Function(String refreshToken) _refreshCall;
  final void Function()? _onSessionExpired;

  /// Exclusion mutuelle **inter-isolat**. Le vol unique ci-dessous ne couvre que
  /// cet isolat ; celui de WorkManager a son propre `AuthInterceptor`, et donc
  /// son propre vol unique, sur le même jeton persisté. Voir [RefreshMutex].
  final RefreshMutex _mutex;

  /// Le vol unique. Champ d'instance et non `static` : il y a exactement un
  /// [AuthInterceptor] par instance Dio, et un `static` ferait interférer deux
  /// tests exécutés dans le même isolat.
  Future<String>? _inFlight;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (options.extra[noAuthFlag] == true) {
      handler.next(options);
      return;
    }
    final String? access = _tokens.accessToken;
    if (access != null && access.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $access';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final RequestOptions request = err.requestOptions;
    final bool eligible =
        err.response?.statusCode == 401 &&
        request.extra[noAuthFlag] != true &&
        request.extra[replayedFlag] != true;

    if (!eligible) {
      handler.next(err);
      return;
    }

    final String access;
    try {
      access = await _refreshOnce();
    } on SessionExpired catch (expired) {
      handler.reject(
        DioException(
          requestOptions: request,
          error: expired,
          type: DioExceptionType.badResponse,
          response: err.response,
        ),
      );
      return;
    }

    try {
      final Response<dynamic> replayed = await _replay.fetch<dynamic>(
        request.copyWith(
          headers: <String, dynamic>{
            ...request.headers,
            'Authorization': 'Bearer $access',
          },
          extra: <String, dynamic>{...request.extra, replayedFlag: true},
        ),
      );
      handler.resolve(replayed);
    } on DioException catch (e) {
      handler.next(e);
    }
  }

  /// Renouvellement en vol unique. Tous les 401 concurrents attendent le même
  /// `Future` ; le premier arrivé le crée, le dernier servi l'efface.
  Future<String> _refreshOnce() {
    final Future<String>? pending = _inFlight;
    if (pending != null) return pending;

    // Le verrou est pris À L'INTÉRIEUR du vol : les 401 concurrents de CET
    // isolat attendent déjà le même `Future`, il ne reste à sérialiser que les
    // isolats entre eux. La lecture du jeton se fait sous verrou (elle est en
    // tête de `_performRefresh`), donc on relit toujours celui que l'isolat
    // précédent vient d'écrire, jamais celui qu'il a déjà consommé.
    final Future<String> flight = _mutex.protect(_performRefresh);
    _inFlight = flight;
    // `whenComplete` et non `then` : le vol doit être libéré même si le
    // renouvellement a échoué, sinon un échec réseau ponctuel condamnerait
    // définitivement toute tentative ultérieure de renouvellement.
    flight.whenComplete(() {
      if (identical(_inFlight, flight)) _inFlight = null;
    });
    return flight;
  }

  Future<String> _performRefresh() async {
    final String? refresh = await _tokens.readRefreshToken();
    if (refresh == null || refresh.isEmpty) {
      await _expire();
      throw const SessionExpired('aucun jeton de renouvellement');
    }
    try {
      final RefreshedTokens fresh = await _refreshCall(refresh);
      await _tokens.save(
        accessToken: fresh.accessToken,
        refreshToken: fresh.refreshToken,
      );
      return fresh.accessToken;
    } on DioException catch (e) {
      // Un 401/403 sur le renouvellement veut dire « ce jeton ne vaut plus
      // rien » : la session est finie. Un timeout ou une coupure, en revanche,
      // ne dit rien sur la validité du jeton : le détruire déconnecterait un
      // commercial hors ligne qui n'a rien fait de mal.
      final int? status = e.response?.statusCode;
      if (status == 401 || status == 403) {
        await _expire();
        throw SessionExpired(e);
      }
      rethrow;
    }
  }

  Future<void> _expire() async {
    await _tokens.clear();
    _onSessionExpired?.call();
  }
}
