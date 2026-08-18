import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter/foundation.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

@immutable
class AuthState {
  const AuthState({
    required this.status,
    this.userId,
    this.fullName,
    this.role,
    this.email,
    this.departementId,
    this.errorMessage,
    this.isSubmitting = false,
  });

  const AuthState.unknown() : this(status: AuthStatus.unknown);
  const AuthState.signedOut({String? errorMessage})
    : this(status: AuthStatus.unauthenticated, errorMessage: errorMessage);

  final AuthStatus status;

  final String? userId;

  final String? fullName;

  final String? role;

  final String? email;

  final String? departementId;

  final String? errorMessage;
  final bool isSubmitting;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isResolved => status != AuthStatus.unknown;

  String? get roleLabel {
    final String? raw = role;
    if (raw == null) return null;
    final Role parsed = Role.values.firstWhere(
      (Role r) => r.value == raw.toUpperCase(),
      orElse: () => Role.unknownDefaultOpenApi,
    );
    return switch (parsed) {
      Role.COMMERCIAL => 'Téléconseiller',
      Role.ADMIN => 'Administrateur',
      Role.BANQUE_FINANCE => 'Banque et financement',
      Role.SUPERVISEUR => 'Supervision',
      Role.unknownDefaultOpenApi => raw,
    };
  }

  AuthState copyWith({
    AuthStatus? status,
    String? userId,
    String? fullName,
    String? role,
    String? email,
    String? departementId,
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
      departementId: departementId ?? this.departementId,
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
          other.departementId == departementId &&
          other.errorMessage == errorMessage &&
          other.isSubmitting == isSubmitting;

  @override
  int get hashCode => Object.hash(
    status,
    userId,
    fullName,
    role,
    email,
    departementId,
    errorMessage,
    isSubmitting,
  );
}
