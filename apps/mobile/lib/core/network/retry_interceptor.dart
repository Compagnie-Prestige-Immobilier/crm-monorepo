import 'dart:async';
import 'dart:math';

import 'package:dio/dio.dart';

import 'retry_after.dart';

/// Réessai **sur les GET uniquement**.
///
/// ─────────────────────────────────────────────────────────────────────────────
/// LIRE AVANT D'ÉLARGIR CETTE RÈGLE.
///
/// Les réessais d'écriture appartiennent à l'outbox, et à elle seule. Deux
/// couches de réessai ne s'additionnent pas, elles se **multiplient** :
/// 3 tentatives Dio × 8 tentatives d'outbox = 24 envois du même lot sur un lien
/// qui, par hypothèse, est déjà en train d'échouer. Sur un forfait data
/// sénégalais et une batterie de téléphone d'entrée de gamme, c'est le
/// comportement le plus nuisible que puisse avoir cette app.
///
/// L'outbox est par ailleurs la seule couche qui sache réessayer *utilement* :
/// elle persiste, elle survit à la fermeture de l'app, elle porte la clé
/// d'idempotence, et elle sait qu'après huit échecs il faut arrêter et demander
/// à l'utilisateur. Dio ne sait rien de tout ça.
///
/// Donc : pas de réessai global, jamais. Si quelqu'un lit ceci en se disant
/// qu'ajouter un réessai sur POST rendrait service, la réponse est non : c'est
/// l'outbox qu'il faut regarder.
/// ─────────────────────────────────────────────────────────────────────────────
///
/// Le GET est différent : il est idempotent par définition HTTP, il ne passe pas
/// par l'outbox (le pull n'a pas d'état à préserver), et une page de pull perdue
/// sur une coupure de 200 ms n'a aucune raison de remonter jusqu'à l'utilisateur.
class RetryInterceptor extends Interceptor {
  RetryInterceptor({
    required Dio dio,
    this.maxRetries = 2,
    this.baseDelay = const Duration(milliseconds: 400),
    this.maxRetryAfter = const Duration(minutes: 2),
    Random? random,
  }) : _dio = dio,
       _random = random ?? Random();

  /// **Le transport de l'application, avec toute sa chaîne d'intercepteurs.**
  ///
  /// ═══ POURQUOI PAS UN DIO NEUF ═══
  ///
  /// Le rejeu partait sur un `Dio` fabriqué à la volée, donc **sans
  /// `AuthInterceptor`**. Conséquence : un GET réessayé après l'expiration du
  /// jeton d'accès : ce qui est le cas nominal, puisqu'on ne réessaie qu'après
  /// plusieurs centaines de millisecondes de panne : revenait en 401 brut. Ce
  /// 401 était ensuite passé à `handler.next()`, donc **vers l'avant**, sans
  /// jamais repasser par le renouvellement : `DioApi.classify` le traduisait en
  /// `SESSION_EXPIRED` et le commercial était déconnecté, alors qu'un jeton de
  /// renouvellement parfaitement valide dormait dans le stockage chiffré.
  ///
  /// Rejouer à travers la chaîne réelle ne boucle pas : le compteur de
  /// tentatives voyage dans `extra`, et [maxRetries] le borne.
  final Dio _dio;

  final int maxRetries;
  final Duration baseDelay;

  /// Plafond de l'attente imposée par `Retry-After`. Au-delà, il vaut mieux
  /// rendre l'erreur à l'appelant que de figer un écran plusieurs minutes.
  final Duration maxRetryAfter;

  final Random _random;

  static const String _attemptKey = 'cpi.getRetryAttempt';

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final RequestOptions request = err.requestOptions;

    if (request.method.toUpperCase() != 'GET' || !_isTransient(err)) {
      handler.next(err);
      return;
    }

    final int attempt = (request.extra[_attemptKey] as int?) ?? 0;
    if (attempt >= maxRetries) {
      handler.next(err);
      return;
    }

    final Duration wait = _delayFor(err, attempt);
    if (wait > maxRetryAfter) {
      // Le serveur demande plus que ce qu'on est prêt à attendre en ligne :
      // c'est à l'appelant de décider, pas à un intercepteur de bloquer l'écran.
      handler.next(err);
      return;
    }
    await Future<void>.delayed(wait);

    try {
      final Response<dynamic> response = await _dio.fetch<dynamic>(
        request.copyWith(
          extra: <String, dynamic>{...request.extra, _attemptKey: attempt + 1},
        ),
      );
      handler.resolve(response);
    } on DioException catch (e) {
      handler.next(e);
    }
  }

  /// Combien attendre avant le prochain essai.
  ///
  /// **`Retry-After` prime sur le back-off.** Sur un 429, le serveur dit
  /// exactement quand revenir ; l'ignorer et repartir sur 400 ms est la façon la
  /// plus sûre de se refaire limiter, deux fois de suite, et de transformer un
  /// throttling passager en échec.
  Duration _delayFor(DioException err, int attempt) {
    if (err.response?.statusCode == 429) {
      final Duration? asked = retryAfterOf(err.response);
      if (asked != null) return asked;
    }
    // Gigue complète, comme dans l'outbox : trente appareils qui retrouvent le
    // réseau au retour d'une antenne ne doivent pas réessayer à la même
    // milliseconde.
    final int ceiling = baseDelay.inMilliseconds << attempt;
    return Duration(milliseconds: _random.nextInt(ceiling + 1));
  }

  /// Ce qui peut raisonnablement réussir au coup suivant. Un 404 ou un 422 n'en
  /// fait pas partie : le réessayer c'est perdre du temps et de la batterie pour
  /// obtenir la même réponse.
  static bool _isTransient(DioException err) {
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
      case DioExceptionType.connectionError:
        return true;
      case DioExceptionType.badResponse:
        final int status = err.response?.statusCode ?? 0;
        return status >= 500 || status == 408 || status == 425 || status == 429;
      case DioExceptionType.cancel:
      case DioExceptionType.badCertificate:
      case DioExceptionType.unknown:
        return false;
    }
  }
}
