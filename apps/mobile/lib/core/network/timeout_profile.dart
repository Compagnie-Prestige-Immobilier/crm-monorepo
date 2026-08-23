import 'package:dio/dio.dart';

enum TimeoutProfile {
  read(Duration(seconds: 30)),

  /// `sendTimeout` est le budget TOTAL d'émission du corps, pas un délai
  /// d'inactivité : sur EDGE, les 512 Ko d'un lot ne passent pas en 30 s, et le
  /// lot expirait à chaque cycle sans jamais devenir visible.
  push(Duration(seconds: 60), send: Duration(minutes: 4)),

  /// Serré à dessein : trois tentatives de renouvellement doivent tenir sous le
  /// bail du verrou (`DatabaseRefreshMutex.leaseDuration`), sans quoi le bail
  /// expire pendant le renouvellement qu'il protège.
  refresh(
    Duration(seconds: 10),
    send: Duration(seconds: 6),
    connect: Duration(seconds: 8),
  ),

  upload(Duration(minutes: 5), send: Duration(minutes: 5));

  const TimeoutProfile(this.receive, {this.send, this.connect});

  final Duration receive;
  final Duration? send;
  final Duration? connect;

  static const String extraKey = 'cpi.timeoutProfile';

  Map<String, dynamic> get extra => <String, dynamic>{extraKey: name};
}

class TimeoutProfileInterceptor extends Interceptor {
  const TimeoutProfileInterceptor();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final Object? raw = options.extra[TimeoutProfile.extraKey];
    if (raw is String) {
      for (final TimeoutProfile profile in TimeoutProfile.values) {
        if (profile.name == raw) {
          options.receiveTimeout = profile.receive;
          if (profile.send != null) {
            options.sendTimeout = profile.send;
          }
          if (profile.connect != null) {
            options.connectTimeout = profile.connect;
          }
          break;
        }
      }
    }
    handler.next(options);
  }
}
