import 'package:dio/dio.dart';

import '../utils/ids.dart';

class RequestIdInterceptor extends Interceptor {
  const RequestIdInterceptor();

  static const String header = 'X-Request-Id';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers.putIfAbsent(header, Ids.newRequestId);
    handler.next(options);
  }
}
