import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../core/sync/token_store.dart';

/// Stockage des jetons sur l'appareil.
///
/// Deux traitements différents, volontairement :
///
/// * **Jeton d'accès : mémoire uniquement.** Il vit quinze minutes et se
///   renouvelle. L'écrire sur disque n'allongerait pas la session d'une seconde
///   et ajouterait une copie de plus à voler.
/// * **Jeton de renouvellement : stockage chiffré.** C'est lui qui porte la
///   session à travers les redémarrages, donc lui qu'il faut protéger.
///
/// À propos de `AndroidOptions(encryptedSharedPreferences: true)` : ce drapeau
/// est **déprécié et ignoré** depuis `flutter_secure_storage` 10.3. Il activait
/// `EncryptedSharedPreferences` de Jetpack Security, que Google a lui-même
/// déprécié. Le paquet chiffre désormais sans condition : AES-256-GCM, clé
/// enveloppée par RSA-OAEP dans l'Android KeyStore : et migre les données
/// existantes au premier accès. Le passer aujourd'hui n'ajoute rien et fait
/// remonter un avertissement de dépréciation ; l'intention (« les jetons ne
/// touchent jamais un fichier en clair ») est tenue par défaut.
class SecureTokenStore implements TokenStore {
  SecureTokenStore({FlutterSecureStorage? storage})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            aOptions: AndroidOptions(
              // Espace de noms explicite : sans lui, une future app CPI sur le
              // même appareil pourrait entrer en collision de clés.
              storageNamespace: 'sn.cpi.go.tokens',
              // Un jeton illisible (rotation de clé, restauration de sauvegarde)
              // doit se solder par une reconnexion, pas par un plantage au
              // démarrage sans issue.
              resetOnError: true,
            ),
          );

  static const String _refreshKey = 'refresh_token';
  static const String _userIdKey = 'user_id';
  static const String _userNameKey = 'user_name';
  static const String _userRoleKey = 'user_role';
  static const String _userEmailKey = 'user_email';

  final FlutterSecureStorage _storage;

  String? _accessToken;

  /// Quand « rester connecté » est décoché, le refresh ne touche pas le disque.
  bool persistRefreshToken = true;
  String? _volatileRefreshToken;

  @override
  String? get accessToken => _accessToken;

  @override
  Future<void> save({required String accessToken, required String refreshToken}) async {
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
