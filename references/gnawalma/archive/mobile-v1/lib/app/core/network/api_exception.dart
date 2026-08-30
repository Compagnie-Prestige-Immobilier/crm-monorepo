import 'package:dio/dio.dart';

import 'api_problem.dart';

enum ApiFailureKind {
  offline,
  timeout,
  cancelled,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validation,
  rateLimited,
  server,
  unknown,
}

class ApiException implements Exception {
  const ApiException({
    required this.kind,
    required this.message,
    this.statusCode,
    this.problem,
  });

  final ApiFailureKind kind;
  final String message;
  final int? statusCode;
  final ApiProblem? problem;

  factory ApiException.fromDio(DioException error) {
    if (error.type == DioExceptionType.cancel) {
      return const ApiException(
        kind: ApiFailureKind.cancelled,
        message: 'Opération annulée.',
      );
    }

    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      return const ApiException(
        kind: ApiFailureKind.timeout,
        // Says what is happening and what to do. The server sleeps when idle
        // and takes close to a minute to wake, so the first attempt after a
        // quiet period can genuinely run out of time — and "le serveur met trop
        // de temps à répondre" reads as a broken service rather than as
        // something that succeeds on the next try.
        message:
            'Le serveur se réveille et n’a pas répondu à temps. Patientez quelques secondes puis réessayez.',
      );
    }

    if (error.type == DioExceptionType.connectionError) {
      return const ApiException(
        kind: ApiFailureKind.offline,
        message:
            'Connexion indisponible. Vérifiez votre réseau puis réessayez.',
      );
    }

    final status = error.response?.statusCode;
    ApiProblem? problem;
    final data = error.response?.data;
    if (data is Map) {
      problem = ApiProblem.fromJson(
        Map<String, dynamic>.from(data),
        fallbackStatus: status,
      );
    }

    final kind = switch (status) {
      401 => ApiFailureKind.unauthorized,
      403 => ApiFailureKind.forbidden,
      404 => ApiFailureKind.notFound,
      409 => ApiFailureKind.conflict,
      400 || 422 => ApiFailureKind.validation,
      429 => ApiFailureKind.rateLimited,
      _ when status != null && status >= 500 => ApiFailureKind.server,
      _ => ApiFailureKind.unknown,
    };

    return ApiException(
      kind: kind,
      statusCode: status,
      problem: problem,
      message: problem?.detail ?? problem?.title ?? _fallbackMessage(kind),
    );
  }

  static String _fallbackMessage(ApiFailureKind kind) {
    return switch (kind) {
      ApiFailureKind.unauthorized => 'Votre session a expiré.',
      ApiFailureKind.forbidden => 'Vous n’avez pas accès à cette action.',
      ApiFailureKind.notFound => 'La ressource demandée est introuvable.',
      ApiFailureKind.conflict =>
        'Les données ont changé sur un autre appareil. Actualisez avant de réessayer.',
      ApiFailureKind.validation => 'Certaines informations sont invalides.',
      ApiFailureKind.rateLimited =>
        'Trop de tentatives. Patientez avant de réessayer.',
      ApiFailureKind.server => 'Le service rencontre un problème temporaire.',
      _ => 'Une erreur inattendue est survenue.',
    };
  }

  @override
  String toString() => message;
}
