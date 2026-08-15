import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter/foundation.dart';

/// Trois états, pas deux.
///
/// [unknown] existe parce que la lecture du jeton de renouvellement est
/// asynchrone. Sans lui, le garde de route voit « pas authentifié » pendant les
/// quelques millisecondes de la lecture et renvoie l'utilisateur sur l'écran de
/// connexion à chaque démarrage à froid : alors qu'il a une session valide.
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

  /// Rôle en français, pour l'affichage.
  ///
  /// ═══ LE MIROIR DIVERGEAIT DU SERVEUR ═══
  ///
  /// Cette table était écrite à la main. Elle manquait `BANQUE_FINANCE`, qui
  /// existe : un utilisateur de banque voyait donc la chaîne brute
  /// `BANQUE_FINANCE` dans ses réglages, à la place de son rôle. Et elle
  /// inventait `SUPERVISEUR`, `SUPERVISOR` et `FINANCE`, qui n'existent nulle
  /// part côté serveur : trois branches mortes qui donnaient l'illusion d'une
  /// couverture complète.
  ///
  /// On part maintenant de l'énumération GÉNÉRÉE depuis `apps/api/openapi.json`.
  /// Un rôle ajouté côté serveur fait apparaître un cas non traité au prochain
  /// `build_runner`, ce qu'aucune relecture de `switch` sur chaînes n'aurait
  /// signalé.
  ///
  /// Un rôle que le client généré ne connaît pas encore
  /// (`unknown_default_open_api`, grâce à `enumUnknownDefaultCase: true`) se rend
  /// TEL QU'IL EST ARRIVÉ, jamais vide : un mot inattendu se remarque et remonte,
  /// un champ vide passe inaperçu pendant des mois.
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
      Role.unknownDefaultOpenApi => raw,
    };
  }

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
