import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../modules/auth/domain/auth_session.dart';

final authSessionStoreProvider = Provider<AuthSessionStore>((ref) {
  return AuthSessionStore(const FlutterSecureStorage());
});

class AuthSessionStore {
  AuthSessionStore(this._storage);

  static const _sessionKey = 'authenticated_session_v1';

  final FlutterSecureStorage _storage;
  AuthSession? _cached;
  bool _loaded = false;

  Future<AuthSession?> read() async {
    if (_loaded) return _cached;
    _loaded = true;

    final encoded = await _storage.read(key: _sessionKey);
    if (encoded == null || encoded.isEmpty) return null;

    try {
      _cached = AuthSession.fromJson(
        Map<String, dynamic>.from(jsonDecode(encoded) as Map),
      );
      return _cached;
    } catch (_) {
      await clear();
      return null;
    }
  }

  Future<void> write(AuthSession session) async {
    _cached = session;
    _loaded = true;
    await _storage.write(key: _sessionKey, value: jsonEncode(session.toJson()));
  }

  Future<void> clear() async {
    _cached = null;
    _loaded = true;
    await _storage.delete(key: _sessionKey);
  }
}
