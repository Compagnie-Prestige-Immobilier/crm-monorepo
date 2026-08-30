import 'package:flutter/foundation.dart';

/// Runtime configuration supplied through `--dart-define`.
///
/// Production builds must always provide `API_BASE_URL`. The platform-aware
/// fallback exists only for local development and emulators.
abstract final class AppEnvironment {
  static const _configuredApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static const environmentName = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'development',
  );

  static const enableNetworkLogs = bool.fromEnvironment(
    'ENABLE_NETWORK_LOGS',
    defaultValue: false,
  );

  /// Raw `--dart-define=SEED_DATA=…`. Empty when the flag was not passed.
  static const _seedDataFlag = String.fromEnvironment(
    'SEED_DATA',
    defaultValue: '',
  );

  /// Whether to populate the local database with demo data on first launch.
  ///
  /// `SEED_DATA=1` seeds, `SEED_DATA=0` does not. Left unset, a debug build
  /// seeds and a release build never does — so testing the app needs no flag,
  /// and shipping it cannot accidentally carry fixtures.
  ///
  /// This replaces two separate `const bool useSeedData = false` declarations,
  /// in `main.dart` and in `seed_data_service.dart`, which had to be edited by
  /// hand and kept in step. They were both false, so the seed path had been
  /// dead for as long as it had existed — and the only way to exercise the app
  /// with data was to edit source and rebuild.
  ///
  /// Production is excluded unconditionally: no flag can turn fixtures on in a
  /// production build.
  static bool get seedData {
    if (isProduction) return false;
    return switch (_seedDataFlag.trim().toLowerCase()) {
      '1' || 'true' || 'yes' => true,
      '0' || 'false' || 'no' => false,
      _ => kDebugMode,
    };
  }

  static String get apiBaseUrl {
    final configured = _configuredApiBaseUrl.trim();
    if (configured.isNotEmpty) {
      return _withoutTrailingSlash(configured);
    }

    if (kIsWeb) {
      return 'http://localhost:3000/api/v1';
    }

    return switch (defaultTargetPlatform) {
      TargetPlatform.android => 'http://10.0.2.2:3000/api/v1',
      _ => 'http://localhost:3000/api/v1',
    };
  }

  static bool get isProduction => environmentName == 'production';

  static String resolveMediaUrl(String? value) {
    final candidate = value?.trim() ?? '';
    if (candidate.isEmpty) return '';
    final uri = Uri.tryParse(candidate);
    if (uri != null && uri.hasScheme) return candidate;

    final apiUri = Uri.parse(apiBaseUrl);
    final origin = apiUri.replace(path: '', query: null, fragment: null);
    return origin
        .resolve(candidate.startsWith('/') ? candidate.substring(1) : candidate)
        .toString();
  }

  static String _withoutTrailingSlash(String value) {
    var result = value;
    while (result.endsWith('/')) {
      result = result.substring(0, result.length - 1);
    }
    return result;
  }
}
