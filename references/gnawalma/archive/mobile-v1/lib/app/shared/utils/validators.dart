/// Utilitaires de validation de formulaires
///
/// Fournit des fonctions de validation réutilisables pour les champs de formulaire.
class Validators {
  Validators._(); // Constructeur privé pour empêcher l'instanciation

  // ===== Validateurs Généraux =====

  /// Valide un champ requis
  static String? required(String? value, {String? fieldName}) {
    if (value == null || value.trim().isEmpty) {
      return 'Le champ ${fieldName ?? ""} est requis';
    }
    return null;
  }

  /// Valide une longueur minimale
  static String? minLength(String? value, int length, {String? fieldName}) {
    if (value == null || value.isEmpty) return null;

    if (value.length < length) {
      return '${fieldName ?? "Ce champ"} doit contenir au moins $length caractères';
    }
    return null;
  }

  /// Valide une longueur maximale
  static String? maxLength(String? value, int length, {String? fieldName}) {
    if (value == null || value.isEmpty) return null;

    if (value.length > length) {
      return '${fieldName ?? "Ce champ"} ne doit pas dépasser $length caractères';
    }
    return null;
  }

  // ===== Validateur Email =====

  /// Valide le format de l'email
  static String? email(String? value) {
    if (value == null || value.isEmpty) return null;

    final emailRegex = RegExp(
      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
    );

    if (!emailRegex.hasMatch(value)) {
      return 'Veuillez entrer une adresse email valide';
    }
    return null;
  }

  // ===== Validateur Téléphone =====

  /// Valide le numéro de téléphone (Sénégal & International)
  static String? phone(String? value) {
    if (value == null || value.isEmpty) return null;

    // Supprimer les espaces, tirets et parenthèses
    final cleanNumber = value.replaceAll(RegExp(r'[\s\-\(\)]'), '');

    // Sénégal : 9 chiffres (77, 78, 70, 76, 33...) ou format international
    if (!RegExp(r'^[\+]?[0-9]{8,15}$').hasMatch(cleanNumber)) {
      return 'Veuillez entrer un numéro de téléphone valide';
    }

    if (cleanNumber.length < 8) {
      return 'Numéro trop court';
    }

    return null;
  }

  // ===== Validateurs de Nombres =====

  /// Valide un nombre (entier ou décimal)
  static String? number(String? value, {String? fieldName}) {
    if (value == null || value.isEmpty) return null;

    if (double.tryParse(value) == null) {
      return '${fieldName ?? "Ce champ"} doit être un nombre valide';
    }
    return null;
  }

  /// Valide un entier
  static String? integer(String? value, {String? fieldName}) {
    if (value == null || value.isEmpty) return null;

    if (int.tryParse(value) == null) {
      return '${fieldName ?? "Ce champ"} doit être un nombre entier';
    }
    return null;
  }

  /// Valide un nombre positif
  static String? positiveNumber(String? value, {String? fieldName}) {
    final numberError = number(value, fieldName: fieldName);
    if (numberError != null) return numberError;

    if (value == null || value.isEmpty) return null;

    final numValue = double.parse(value);
    if (numValue <= 0) {
      return '${fieldName ?? "Ce champ"} doit être supérieur à 0';
    }
    return null;
  }

  /// Valide un nombre non-négatif (>= 0)
  static String? nonNegativeNumber(String? value, {String? fieldName}) {
    final numberError = number(value, fieldName: fieldName);
    if (numberError != null) return numberError;

    if (value == null || value.isEmpty) return null;

    final numValue = double.parse(value);
    if (numValue < 0) {
      return '${fieldName ?? "Ce champ"} ne peut pas être négatif';
    }
    return null;
  }

  // ===== Validateurs de Prix / Métrage =====

  /// Valide un prix
  static String? price(String? value) {
    if (value == null || value.isEmpty) return null;

    final cleanValue = value.replaceAll(',', '').replaceAll(' ', '');
    final numValue = double.tryParse(cleanValue);

    if (numValue == null) {
      return 'Veuillez entrer un montant valide';
    }

    if (numValue < 0) {
      return 'Le montant ne peut pas être négatif';
    }

    return null;
  }

  /// Valide un métrage de tissu
  static String? fabricMeters(String? value) {
    if (value == null || value.isEmpty) return null;
    final numValue = double.tryParse(value);
    if (numValue == null) return 'Métrage invalide';
    if (numValue < 0) return 'Le métrage ne peut pas être négatif';
    return null;
  }

  // ===== Combinateur de Validateurs =====

  /// Combine plusieurs validateurs
  static String? Function(String?) combine(
    List<String? Function(String?)> validators,
  ) {
    return (String? value) {
      for (final validator in validators) {
        final error = validator(value);
        if (error != null) return error;
      }
      return null;
    };
  }
}
