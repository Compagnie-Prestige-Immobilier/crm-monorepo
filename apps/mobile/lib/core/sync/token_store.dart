abstract interface class TokenStore {
  String? get accessToken;

  Future<void> save({
    required String accessToken,
    required String refreshToken,
  });

  void setAccessToken(String accessToken);

  Future<String?> readRefreshToken();

  Future<String?> readUserId();

  Future<void> clear();
}

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
