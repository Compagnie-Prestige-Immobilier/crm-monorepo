/// Adresse du serveur — **Dart pur**.
///
/// `10.0.2.2` est l'alias de la machine hôte vu depuis l'émulateur Android ;
/// `localhost` y désigne l'émulateur lui-même et ne répond à rien. La valeur est
/// surchargeable au build sans toucher au code :
///
///     flutter run --dart-define=CPI_API_BASE_URL=https://api.cpi.sn
abstract final class ApiEnvironment {
  static const String baseUrl = String.fromEnvironment(
    'CPI_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3001',
  );

  /// En-tête `user-agent` exigé par `/auth/login` et `/auth/refresh` : le
  /// serveur s'en sert pour lier une famille de jetons à un appareil.
  static const String userAgent = 'CPI-GO/1.0 (Android)';
}
