class AppExceptions implements Exception {
  final String message;
  final String? code;

  AppExceptions(this.message, [this.code]);

  @override
  String toString() => message;
}

class ClientNotFoundException extends AppExceptions {
  ClientNotFoundException() : super('Client non trouvé', 'CLIENT_NOT_FOUND');
}

class OrderNotFoundException extends AppExceptions {
  OrderNotFoundException() : super('Commande non trouvée', 'ORDER_NOT_FOUND');
}

class ProjectNotFoundException extends AppExceptions {
  ProjectNotFoundException() : super('Projet non trouvé', 'PROJECT_NOT_FOUND');
}

class SecurityException extends AppExceptions {
  SecurityException(String message) : super(message, 'SECURITY_ERROR');
}
