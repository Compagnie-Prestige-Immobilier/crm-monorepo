import 'package:dio/dio.dart';

/// Profils de délai d'attente, choisis pour la 2G/3G sénégalaise.
///
/// Les valeurs par défaut de Dio (et celles que le client généré se donne s'il
/// construit son propre transport : 5 s / 3 s) sont calibrées pour du Wi-Fi de
/// bureau. Sur un lien EDGE à 40 kbit/s, un lot de 200 opérations met plus de
/// trois secondes rien qu'à monter : avec 3 s de `receiveTimeout`, aucun envoi
/// n'aboutit jamais, et l'app se comporte comme si le serveur était mort.
enum TimeoutProfile {
  /// Lecture ordinaire (référentiels, lookup, pull) — 30 s.
  read(Duration(seconds: 30)),

  /// Envoi d'un lot d'outbox — 60 s. Un lot peut peser 512 ko et partir sur un
  /// lien montant saturé ; il vaut mieux attendre que réémettre.
  push(Duration(seconds: 60));

  const TimeoutProfile(this.receive);

  final Duration receive;

  static const String extraKey = 'cpi.timeoutProfile';

  /// À passer dans le `extra` des méthodes du client généré, qui n'expose pas
  /// de paramètre de délai d'attente.
  Map<String, dynamic> get extra => <String, dynamic>{extraKey: name};
}

/// Applique le profil demandé à la requête.
///
/// Un intercepteur plutôt qu'un `BaseOptions` unique, parce que les deux profils
/// ont des exigences opposées : 60 s sur un pull ferait poireauter l'écran
/// d'accueil une minute sur un réseau mort, 30 s sur un push couperait un lot
/// qui était en train d'aboutir.
class TimeoutProfileInterceptor extends Interceptor {
  const TimeoutProfileInterceptor();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final Object? raw = options.extra[TimeoutProfile.extraKey];
    if (raw is String) {
      for (final TimeoutProfile profile in TimeoutProfile.values) {
        if (profile.name == raw) {
          options.receiveTimeout = profile.receive;
          break;
        }
      }
    }
    handler.next(options);
  }
}
