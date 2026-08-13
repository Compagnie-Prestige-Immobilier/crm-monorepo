import 'package:flutter/foundation.dart';

/// Trois états, pas deux.
///
/// [unknown] existe parce que la lecture du jeton de renouvellement est
/// asynchrone. Sans lui, le garde de route voit « pas authentifié » pendant les
/// quelques millisecondes de la lecture et renvoie l'utilisateur sur l'écran de
/// connexion à chaque démarrage à froid — alors qu'il a une session valide.
enum AuthStatus { unknown, authenticated, unauthenticated }

@immutable
class AuthState {
  const AuthState({
    required this.status,
    this.userId,
    this.fullName,
    this.role,
    this.email,
    this.errorMessage,
    this.isSubmitting = false,
  });

  const AuthState.unknown() : this(status: AuthStatus.unknown);
  const AuthState.signedOut({String? errorMessage})
    : this(status: AuthStatus.unauthenticated, errorMessage: errorMessage);

  final AuthStatus status;

  /// Identifiant technique. **Il ne s'affiche pas** sur un écran courant : ce
  /// n'est pas une information, c'est une clé de base de données. Il n'a sa
  /// place que dans « À propos », derrière les informations de support.
  final String? userId;

  final String? fullName;

  /// Rôle brut du serveur (`COMMERCIAL`, `ADMIN`…), traduit à l'affichage.
  final String? role;

  final String? email;

  final String? errorMessage;
  final bool isSubmitting;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isResolved => status != AuthStatus.unknown;

  /// Rôle en français, pour l'affichage. Un rôle inconnu se rend tel quel
  /// plutôt que de disparaître : une chaîne vide se remarque moins qu'un mot
  /// inattendu, et c'est le mot inattendu qui fait remonter le bug.
  String? get roleLabel => switch (role?.toUpperCase()) {
    null => null,
    'COMMERCIAL' => 'Téléconseiller',
    'ADMIN' => 'Administrateur',
    'SUPERVISEUR' || 'SUPERVISOR' => 'Superviseur',
    'FINANCE' => 'Finances générales',
    final String other => other,
  };

  AuthState copyWith({
    AuthStatus? status,
    String? userId,
    String? fullName,
    String? role,
    String? email,
    String? errorMessage,
    bool clearError = false,
    bool? isSubmitting,
  }) {
    return AuthState(
      status: status ?? this.status,
      userId: userId ?? this.userId,
      fullName: fullName ?? this.fullName,
      role: role ?? this.role,
      email: email ?? this.email,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      isSubmitting: isSubmitting ?? this.isSubmitting,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthState &&
          other.status == status &&
          other.userId == userId &&
          other.fullName == fullName &&
          other.role == role &&
          other.email == email &&
          other.errorMessage == errorMessage &&
          other.isSubmitting == isSubmitting;

  @override
  int get hashCode =>
      Object.hash(status, userId, fullName, role, email, errorMessage, isSubmitting);
}
