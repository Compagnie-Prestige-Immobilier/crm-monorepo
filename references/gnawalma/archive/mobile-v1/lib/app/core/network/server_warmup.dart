import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../config/app_environment.dart';

/// Réveille le backend dès le lancement de l'application.
///
/// L'API tourne sur une instance Render qui se met en veille après quelques
/// minutes sans trafic. La première requête qui l'atteint la redémarre, ce qui
/// coûte près d'une minute — et cette minute est payée par le premier écran que
/// l'utilisateur ouvre, donc par l'utilisateur.
///
/// Ce ping part au tout début de `main()`, en parallèle de l'ouverture de la
/// base locale et du premier rendu. Le serveur démarre donc pendant que
/// l'utilisateur traverse le démarrage et l'écran d'accueil, et la première
/// vraie requête trouve une instance déjà chaude.
///
/// Volontairement silencieux : un échec ne doit jamais empêcher l'application
/// de démarrer, puisque le mode hors-ligne reste utilisable.
abstract final class ServerWarmup {
  /// Sonde de vivacité de l'API. Ne touche pas la base de données, donc elle
  /// répond dès que le processus Node écoute — c'est bien le réveil de
  /// l'instance que l'on cherche, pas l'état du schéma.
  static const _path = '/health';

  static const _attempts = 2;
  static const _retryDelay = Duration(seconds: 3);

  static bool _started = false;

  /// Lance le ping sans l'attendre.
  ///
  /// Appelable plusieurs fois sans effet supplémentaire : seul le premier
  /// appel déclenche une requête.
  static void kick() {
    if (_started) return;
    _started = true;
    unawaited(_ping());
  }

  /// Réinitialise l'état déclenché. Réservé aux tests.
  @visibleForTesting
  static void resetForTest() => _started = false;

  static Future<void> _ping() async {
    final baseUrl = AppEnvironment.apiBaseUrl;
    if (baseUrl.isEmpty) return;

    final dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        // Render garde la connexion ouverte pendant tout le démarrage de
        // l'instance. Le délai de réception est donc long à dessein : couper
        // trop tôt annulerait le réveil que l'on vient de déclencher.
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 90),
        headers: const {
          'Accept': 'application/json',
          'X-Client-Platform': 'mobile',
          'X-Warmup': '1',
        },
      ),
    );

    try {
      for (var attempt = 1; attempt <= _attempts; attempt++) {
        try {
          final response = await dio.get<dynamic>(_path);
          _log('serveur joignable (${response.statusCode}).');
          return;
        } on DioException catch (error) {
          _log('tentative $attempt sans réponse (${error.type.name}).');
          if (attempt == _attempts) return;
          await Future<void>.delayed(_retryDelay);
        } catch (error) {
          _log('tentative $attempt interrompue ($error).');
          return;
        }
      }
    } finally {
      dio.close(force: true);
    }
  }

  static void _log(String message) {
    if (kDebugMode) debugPrint('[Warmup] $message');
  }
}
