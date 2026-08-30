import '../../../core/network/api_client.dart';
import '../domain/auth_session.dart';

class AuthRepository {
  const AuthRepository(this._api);

  final ApiClient _api;

  Future<AuthSession> login({
    required String identifier,
    required String pin,
  }) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/auth/login',
      requiresAuth: false,
      data: {'identifier': identifier.trim(), 'pin': pin},
    );
    return AuthSession.fromTokenResponse(response);
  }

  Future<void> register({
    required String displayName,
    required String identifier,
    required String pin,
    required String role,
  }) async {
    final normalizedIdentifier = identifier.trim();
    await _api.post<Map<String, dynamic>>(
      '/auth/register',
      requiresAuth: false,
      data: {
        if (normalizedIdentifier.contains('@'))
          'email': normalizedIdentifier.toLowerCase()
        else
          'phone': normalizedIdentifier,
        'pin': pin,
        'displayName': displayName.trim(),
        'role': role,
      },
    );
  }

  Future<AuthSession> enrichSession(AuthSession session) async {
    final profile = await _api.get<Map<String, dynamic>>('/auth/me');
    return session.copyWith(
      accountId: profile['accountId'] as String?,
      displayName: profile['displayName'] as String?,
      role: profile['role'] as String?,
      phone: profile['phone'] as String?,
      email: profile['email'] as String?,
      ateliers: (profile['ateliers'] as List<dynamic>? ?? const [])
          .map(
            (item) => AuthAtelierSummary.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(growable: false),
    );
  }

  /// Revokes the session server-side and clears it from this device.
  ///
  /// The local clear is unconditional and runs even when the network call
  /// fails: previously it depended on the caller separately invoking
  /// `SessionController.clearSession()`, so a logout that failed to reach the
  /// server left valid tokens in secure storage on a device the user believed
  /// they had signed out of.
  Future<void> logout() async {
    try {
      await _api.post<void>('/auth/logout');
    } finally {
      await _api.clearStoredSession();
    }
  }
}
