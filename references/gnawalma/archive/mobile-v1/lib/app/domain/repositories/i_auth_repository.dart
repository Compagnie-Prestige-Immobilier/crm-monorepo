abstract class IAuthRepository {
  /// Validates the user's PIN against stored credentials
  Future<bool> validatePin(String pin);

  /// Checks if a PIN is already set (user is registered)
  Future<bool> hasPin();

  /// Sets a new PIN for the user
  Future<void> setPin(String pin);

  /// Saves the initial business profile during registration
  Future<void> saveProfile({
    required String businessName,
    required String phone,
  });
  Future<dynamic>
  getProfile(); // Dynamic or concrete model? We should verify dependency.
}
