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
    this.errorMessage,
    this.isSubmitting = false,
  });

  const AuthState.unknown() : this(status: AuthStatus.unknown);
  const AuthState.signedOut({String? errorMessage})
    : this(status: AuthStatus.unauthenticated, errorMessage: errorMessage);

  final AuthStatus status;
  final String? userId;
  final String? fullName;
  final String? errorMessage;
  final bool isSubmitting;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isResolved => status != AuthStatus.unknown;

  AuthState copyWith({
    AuthStatus? status,
    String? userId,
    String? fullName,
    String? errorMessage,
    bool clearError = false,
    bool? isSubmitting,
  }) {
    return AuthState(
      status: status ?? this.status,
      userId: userId ?? this.userId,
      fullName: fullName ?? this.fullName,
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
          other.errorMessage == errorMessage &&
          other.isSubmitting == isSubmitting;

  @override
  int get hashCode => Object.hash(status, userId, fullName, errorMessage, isSubmitting);
}
