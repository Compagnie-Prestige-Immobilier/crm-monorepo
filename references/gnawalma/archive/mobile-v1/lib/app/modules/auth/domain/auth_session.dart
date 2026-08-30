import 'dart:convert';

class AuthAtelierSummary {
  const AuthAtelierSummary({
    required this.id,
    required this.name,
    required this.status,
    required this.membershipRole,
  });

  final String id;
  final String name;
  final String status;
  final String membershipRole;

  factory AuthAtelierSummary.fromJson(Map<String, dynamic> json) {
    return AuthAtelierSummary(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      status: json['status'] as String? ?? 'draft',
      // Defaults to the *least* privileged role. This was 'atelier_owner', so a
      // response that omitted the field — or any future role this build does
      // not know — silently granted owner rights on the device.
      membershipRole: json['membershipRole'] as String? ?? 'atelier_manager',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'status': status,
    'membershipRole': membershipRole,
  };
}

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.accessTokenExpiresAt,
    required this.sessionId,
    this.tokenType = 'Bearer',
    this.accountId,
    this.displayName,
    this.role,
    this.phone,
    this.email,
    this.ateliers = const [],
  });

  final String accessToken;
  final String refreshToken;
  final DateTime accessTokenExpiresAt;
  final String sessionId;

  /// The scheme the server asked for. Was dropped on parse and 'Bearer '
  /// hardcoded at the call site instead, so the field existed in the response,
  /// in the spec, and nowhere in the client.
  final String tokenType;

  final String? accountId;
  final String? displayName;
  final String? role;
  final String? phone;
  final String? email;
  final List<AuthAtelierSummary> ateliers;

  bool get isAccessTokenExpired => DateTime.now().isAfter(
    accessTokenExpiresAt.subtract(const Duration(seconds: 20)),
  );

  AuthSession copyWith({
    String? accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiresAt,
    String? sessionId,
    String? tokenType,
    String? accountId,
    String? displayName,
    String? role,
    String? phone,
    String? email,
    List<AuthAtelierSummary>? ateliers,
  }) {
    return AuthSession(
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      accessTokenExpiresAt: accessTokenExpiresAt ?? this.accessTokenExpiresAt,
      sessionId: sessionId ?? this.sessionId,
      tokenType: tokenType ?? this.tokenType,
      accountId: accountId ?? this.accountId,
      displayName: displayName ?? this.displayName,
      role: role ?? this.role,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      ateliers: ateliers ?? this.ateliers,
    );
  }

  factory AuthSession.fromTokenResponse(Map<String, dynamic> json) {
    final accessToken = json['accessToken'] as String;
    final expiresInSeconds = (json['expiresInSeconds'] as num?)?.toInt() ?? 900;
    return AuthSession(
      accessToken: accessToken,
      refreshToken: json['refreshToken'] as String,
      // The token's own `exp` is authoritative. Deriving the expiry from
      // `DateTime.now() + expiresInSeconds` measured it against the device
      // clock: a phone running fast refreshed early and burned sessions, one
      // running slow kept sending a token the server had already rejected and
      // only recovered via the 401 path. Falls back to the relative value when
      // the claim cannot be read.
      accessTokenExpiresAt:
          _expiryFromJwt(accessToken) ??
          DateTime.now().toUtc().add(Duration(seconds: expiresInSeconds)),
      sessionId: json['sessionId'] as String,
      tokenType: json['tokenType'] as String? ?? 'Bearer',
    );
  }

  /// Reads `exp` out of a JWT payload without verifying the signature.
  ///
  /// Verification is the server's job; this only needs the timestamp, and a
  /// tampered one costs nothing — a wrong expiry produces a 401 the refresh
  /// path already handles.
  static DateTime? _expiryFromJwt(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload = parts[1];
      final normalised = base64Url.normalize(payload);
      final decoded = jsonDecode(utf8.decode(base64Url.decode(normalised)));
      final exp = (decoded as Map<String, dynamic>)['exp'];
      if (exp is! num) return null;
      return DateTime.fromMillisecondsSinceEpoch(
        exp.toInt() * 1000,
        isUtc: true,
      );
    } catch (_) {
      return null;
    }
  }

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      accessTokenExpiresAt: DateTime.parse(
        json['accessTokenExpiresAt'] as String,
      ).toUtc(),
      sessionId: json['sessionId'] as String,
      tokenType: json['tokenType'] as String? ?? 'Bearer',
      accountId: json['accountId'] as String?,
      displayName: json['displayName'] as String?,
      role: json['role'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      ateliers: (json['ateliers'] as List<dynamic>? ?? const [])
          .map(
            (item) => AuthAtelierSummary.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(growable: false),
    );
  }

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'accessTokenExpiresAt': accessTokenExpiresAt.toUtc().toIso8601String(),
    'sessionId': sessionId,
    'tokenType': tokenType,
    'accountId': accountId,
    'displayName': displayName,
    'role': role,
    'phone': phone,
    'email': email,
    'ateliers': ateliers.map((item) => item.toJson()).toList(),
  };
}
