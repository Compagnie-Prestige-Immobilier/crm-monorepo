import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../core/sync/token_store.dart';

class SecureTokenStore implements TokenStore {
  SecureTokenStore({FlutterSecureStorage? storage})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            aOptions: AndroidOptions(
              storageNamespace: 'sn.cpi.go.tokens',
              resetOnError: true,
            ),
          );

  static const String _refreshKey = 'refresh_token';
  static const String _userIdKey = 'user_id';
  static const String _userNameKey = 'user_name';
  static const String _userRoleKey = 'user_role';
  static const String _userEmailKey = 'user_email';

  /// Un compte n'a plus de département : la clé ne survit que le temps
  /// d'être effacée des installations qui l'ont écrite.
  static const String _legacyUserDepartementKey = 'user_departement';

  final FlutterSecureStorage _storage;

  String? _accessToken;

  bool persistRefreshToken = true;
  String? _volatileRefreshToken;

  @override
  String? get accessToken => _accessToken;

  @override
  Future<void> save({
    required String accessToken,
    required String refreshToken,
  }) async {
    _accessToken = accessToken;
    if (persistRefreshToken) {
      _volatileRefreshToken = null;
      await _storage.write(key: _refreshKey, value: refreshToken);
    } else {
      _volatileRefreshToken = refreshToken;
      await _storage.delete(key: _refreshKey);
    }
  }

  @override
  void setAccessToken(String accessToken) => _accessToken = accessToken;

  @override
  Future<String?> readRefreshToken() async {
    if (_volatileRefreshToken != null) return _volatileRefreshToken;
    return _storage.read(key: _refreshKey);
  }

  @override
  Future<void> clear() async {
    _accessToken = null;
    _volatileRefreshToken = null;
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _userIdKey);
    await _storage.delete(key: _userNameKey);
    await _storage.delete(key: _userRoleKey);
    await _storage.delete(key: _userEmailKey);
    await _storage.delete(key: _legacyUserDepartementKey);
  }

  @override
  Future<String?> readUserId() => _storage.read(key: _userIdKey);

  Future<void> saveIdentity({
    required String userId,
    required String fullName,
    String? role,
    String? email,
  }) async {
    await _storage.write(key: _userIdKey, value: userId);
    await _storage.write(key: _userNameKey, value: fullName);
    if (role != null) await _storage.write(key: _userRoleKey, value: role);
    if (email != null) await _storage.write(key: _userEmailKey, value: email);
  }

  Future<({String id, String fullName, String? role, String? email})?>
  readIdentity() async {
    final String? id = await _storage.read(key: _userIdKey);
    if (id == null) return null;
    final String name = await _storage.read(key: _userNameKey) ?? '';
    return (
      id: id,
      fullName: name,
      role: await _storage.read(key: _userRoleKey),
      email: await _storage.read(key: _userEmailKey),
    );
  }
}
