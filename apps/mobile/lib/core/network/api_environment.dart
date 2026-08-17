abstract final class ApiEnvironment {
  static const String productionBaseUrl = 'https://go.cpi-chues.com';

  static const String emulatorHostBaseUrl = 'http://10.0.2.2:3001';

  static const bool _isRelease = bool.fromEnvironment('dart.vm.product');

  static const String baseUrl = String.fromEnvironment(
    'CPI_API_BASE_URL',
    defaultValue: _isRelease ? productionBaseUrl : emulatorHostBaseUrl,
  );

  static bool get isDevelopmentServer =>
      baseUrl.contains('10.0.2.2') ||
      baseUrl.contains('localhost') ||
      baseUrl.contains('127.0.0.1');

  static const String userAgent = 'CPI-GO/1.0 (Android)';
}
