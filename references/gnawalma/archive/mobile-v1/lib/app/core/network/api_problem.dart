class ApiFieldIssue {
  const ApiFieldIssue({required this.path, required this.message});

  final String path;
  final String message;
}

class ApiProblem {
  const ApiProblem({
    required this.status,
    required this.title,
    required this.code,
    this.detail,
    this.instance,
    this.fieldIssues = const [],
  });

  final int status;
  final String title;
  final String code;
  final String? detail;
  final String? instance;
  final List<ApiFieldIssue> fieldIssues;

  factory ApiProblem.fromJson(
    Map<String, dynamic> json, {
    int? fallbackStatus,
  }) {
    final rawIssues = json['fieldErrors'] ?? json['issues'];
    final issues = <ApiFieldIssue>[];
    if (rawIssues is List) {
      for (final item in rawIssues) {
        if (item is! Map) continue;
        final map = Map<String, dynamic>.from(item);
        final pathValue = map['path'];
        final path = pathValue is List ? pathValue.join('.') : '$pathValue';
        issues.add(
          ApiFieldIssue(
            path: path == 'null' ? '' : path,
            message: map['message'] as String? ?? 'Valeur invalide',
          ),
        );
      }
    }

    final status =
        (json['status'] as num?)?.toInt() ??
        (json['statusCode'] as num?)?.toInt() ??
        fallbackStatus ??
        500;

    return ApiProblem(
      status: status,
      title: json['title'] as String? ?? _defaultTitle(status),
      code: json['code'] as String? ?? 'HTTP_$status',
      detail: (json['detail'] ?? json['message']) as String?,
      instance: json['instance'] as String?,
      fieldIssues: issues,
    );
  }

  static String _defaultTitle(int status) {
    return switch (status) {
      400 => 'Requête invalide',
      401 => 'Authentification requise',
      403 => 'Action non autorisée',
      404 => 'Ressource introuvable',
      409 => 'Conflit de données',
      422 => 'Données non valides',
      429 => 'Trop de tentatives',
      >= 500 => 'Service indisponible',
      _ => 'Erreur réseau',
    };
  }
}
