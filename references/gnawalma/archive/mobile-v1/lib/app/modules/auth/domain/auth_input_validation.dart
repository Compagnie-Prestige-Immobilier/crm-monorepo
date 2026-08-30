class AuthInputValidation {
  AuthInputValidation._();

  static bool isDisplayNameValid(String value) => value.trim().length >= 2;

  static bool isPinValid(String value) => RegExp(r'^\d{4,8}$').hasMatch(value);

  /// The one phone rule, mirroring `normalizePhone` on the server
  /// (`apps/api/src/auth/phone.ts`).
  ///
  /// The server converts to E.164 and rejects anything it cannot: a Senegalese
  /// local number is exactly nine digits, `221` + nine, or an explicit
  /// international `+` form. A looser check on this side does not make those
  /// numbers acceptable — it only moves the refusal from a field label the user
  /// can act on to an HTTP 400 they cannot. The atelier setup wizard used
  /// "at least nine digits", so a ten-digit number passed its own validator,
  /// enabled its button, and failed at the server.
  static bool isPhoneValid(String value) {
    final compact = value.trim().replaceAll(RegExp(r'[^\d+]'), '');
    final digits = compact.replaceAll(RegExp(r'\D'), '');
    return digits.length == 9 ||
        (digits.length == 12 && digits.startsWith('221')) ||
        (compact.startsWith('+') && digits.length >= 8 && digits.length <= 15);
  }

  static bool isIdentifierValid(String value) {
    final trimmed = value.trim();
    if (trimmed.contains('@')) {
      return RegExp(
        r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$',
      ).hasMatch(trimmed.toLowerCase());
    }
    return isPhoneValid(trimmed);
  }

  static String? identifierError(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      return 'Saisissez votre téléphone ou votre email.';
    }
    if (isIdentifierValid(trimmed)) return null;
    return trimmed.contains('@')
        ? 'Saisissez une adresse email valide.'
        : 'Saisissez un numéro valide, par exemple 77 000 00 00.';
  }
}
