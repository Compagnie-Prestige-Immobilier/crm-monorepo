import 'package:dio/dio.dart';

enum TimeoutProfile {
  read(Duration(seconds: 30)),

  push(Duration(seconds: 60));

  const TimeoutProfile(this.receive);

  final Duration receive;

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
          break;
        }
      }
    }
    handler.next(options);
  }
}
