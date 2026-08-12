/// Contrat de stockage des jetons — Dart pur, aucune dépendance Flutter.
///
/// L'implémentation réelle s'appuie sur `flutter_secure_storage`, qui est un
/// plugin. L'isolat WorkManager n'a pas de plugins enregistrés : c'est
/// précisément pour ça que le moteur dépend de cette interface et pas de la
/// classe concrète. Le jour où le worker doit lire un jeton, on lui injecte une
/// implémentation adaptée sans toucher au moteur.
abstract interface class TokenStore {
  /// Jeton d'accès. **En mémoire uniquement** : il est court, il se renouvelle,
  /// et le persister ajouterait une surface de vol sans rien apporter.
  String? get accessToken;

  /// Renouvelle le couple. Le refresh est persisté, l'access ne l'est pas.
  Future<void> save({required String accessToken, required String refreshToken});

  /// Remplace le seul jeton d'accès après un refresh réussi.
  void setAccessToken(String accessToken);

  /// Jeton de renouvellement, lu depuis le stockage chiffré.
  Future<String?> readRefreshToken();

  /// Identifiant du commercial connecté.
  ///
  /// Il vit ici et pas dans un provider Riverpod parce que le moteur en a
  /// besoin **dans l'isolat WorkManager**, pour trancher le cas le plus délicat
  /// du système : un 409 sur un téléphone déjà pris se fusionne tout seul si la
  /// fiche est la mienne, et ne se fusionne SURTOUT PAS si elle est à un
  /// collègue — l'attribution détermine la commission. Sans cette information,
  /// le moteur ne peut pas décider et devrait tout remonter à l'utilisateur.
  Future<String?> readUserId();

  /// Vide tout. Appelé à la déconnexion et sur détection de rejeu côté serveur.
  Future<void> clear();
}

/// Implémentation mémoire — utilisée par les tests et par tout contexte qui n'a
/// pas de plugin disponible.
class InMemoryTokenStore implements TokenStore {
  InMemoryTokenStore({String? refreshToken, String? userId})
    : _refreshToken = refreshToken,
      _userId = userId;

  String? _accessToken;
  String? _refreshToken;
  String? _userId;

  @override
  Future<String?> readUserId() async => _userId;

  set userId(String? value) => _userId = value;

  @override
  String? get accessToken => _accessToken;

  @override
  Future<void> save({
    required String accessToken,
    required String refreshToken,
  }) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
  }

  @override
  void setAccessToken(String accessToken) => _accessToken = accessToken;

  @override
  Future<String?> readRefreshToken() async => _refreshToken;

  @override
  Future<void> clear() async {
    _accessToken = null;
    _refreshToken = null;
    _userId = null;
  }
}
