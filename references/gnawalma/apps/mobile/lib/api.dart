import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:fresh_dio/fresh_dio.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:talker_dio_logger/talker_dio_logger.dart';
import 'package:talker_flutter/talker_flutter.dart';

import 'models.dart';

const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:8000/api/v1');

/// Photos de couverture et portfolio : cache borné, sinon le disque grossit sans fin.
final photoCache = CacheManager(Config('gnawalma_photos', maxNrOfCacheObjects: 300, stalePeriod: const Duration(days: 30)));

/// Version installée antérieure au minimum annoncé par /health : le routeur bloque l'application.
final updateRequired = ValueNotifier(false);

/// Compare deux versions « x.y.z » ; vrai si [current] précède [min].
bool versionBelow(String current, String min) {
  final a = _versionParts(current), b = _versionParts(min);
  for (var i = 0; i < 3; i++) {
    if (a[i] != b[i]) return a[i] < b[i];
  }
  return false;
}

List<int> _versionParts(String v) {
  final parts = [for (final p in v.split('.')) int.tryParse(p.split(RegExp(r'\D')).first) ?? 0];
  return [...parts, 0, 0, 0].take(3).toList();
}

final talkerProvider = Provider<Talker>((_) => TalkerFlutter.init());

final offlineProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();
  yield _noNetwork(await connectivity.checkConnectivity());
  yield* connectivity.onConnectivityChanged.map(_noNetwork);
});

bool _noNetwork(List<ConnectivityResult> results) => results.every((r) => r == ConnectivityResult.none);

class ApiException implements Exception {
  ApiException(this.status, this.title, {this.detail, this.errors = const {}, bool? offline, this.local = false}) : offline = offline ?? status == 0;
  final int status;
  final String title;
  final String? detail;
  final Map<String, dynamic> errors;
  final bool offline;
  // Erreur produite côté appareil (ex. confirmation de code) : ne doit pas compter comme un essai serveur.
  final bool local;

  String get message => detail ?? title;
  String? field(String name) => (errors[name] as List?)?.first?.toString();

  factory ApiException.from(DioException e, {bool offline = false}) {
    if (e.error is RevokeTokenException) return ApiException(401, 'Session expirée', detail: 'Reconnectez-vous pour continuer.');
    final data = e.response?.data;
    if (data is Map && data['title'] != null) {
      return ApiException(e.response!.statusCode!, data['title'], detail: data['detail'], errors: (data['errors'] as Map?)?.cast<String, dynamic>() ?? {});
    }
    if (e.response != null) return ApiException(e.response!.statusCode!, 'Erreur serveur');
    if (offline || e.type == DioExceptionType.connectionError || e.error is SocketException) {
      return ApiException(0, 'Pas de connexion', detail: 'Vérifiez votre connexion et réessayez.', offline: true);
    }
    return ApiException(0, 'Le serveur ne répond pas', detail: 'Réessayez dans un instant.', offline: false);
  }
  @override
  String toString() => message;
}

Dio _client(Ref ref) {
  final dio = Dio(BaseOptions(
    baseUrl: apiBaseUrl,
    // L'instance Render s'endort : le premier appel peut attendre son réveil.
    connectTimeout: const Duration(seconds: 40), receiveTimeout: const Duration(seconds: 40),
    headers: {'Accept': 'application/json'},
  ));
  if (kDebugMode) {
    dio.interceptors.add(TalkerDioLogger(talker: ref.read(talkerProvider), settings: const TalkerDioLoggerSettings(printRequestData: false, hiddenHeaders: {'authorization'})));
  }
  return dio;
}

class _SecureTokenStorage implements TokenStorage<OAuth2Token> {
  static const _storage = FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));
  @override
  Future<OAuth2Token?> read() async {
    final token = await _storage.read(key: 'token');
    return token == null ? null : OAuth2Token(accessToken: token);
  }
  @override
  Future<void> write(OAuth2Token token) => _storage.write(key: 'token', value: token.accessToken);
  @override
  Future<void> delete() => _storage.delete(key: 'token');
}

final freshProvider = Provider<Fresh<OAuth2Token>>((ref) => Fresh.oAuth2(
  tokenStorage: _SecureTokenStorage(),
  httpClient: _client(ref),
  // Laravel exige la casse exacte du schéma Bearer.
  tokenHeader: (t) => {'Authorization': 'Bearer ${t.accessToken}'},
  isTokenRequired: (o) => o.extra['auth'] != false,
  refreshToken: (token, client) async {
    try {
      final r = await client.post('/auth/refresh', options: Options(headers: {'Authorization': 'Bearer ${token?.accessToken}'}));
      return OAuth2Token(accessToken: r.data['access_token']);
    } on DioException catch (e) {
      // Sans réponse du serveur, la session est conservée pour réessayer plus tard.
      if (e.response == null) rethrow;
      throw RevokeTokenException();
    }
  },
));

class Api {
  Api(this._ref) {
    _dio = _client(_ref)..interceptors.insert(0, _ref.read(freshProvider));
  }

  final Ref _ref;
  late final Dio _dio;

  Future<T> _run<T>(Future<Response> Function() call) async {
    try {
      return (await call()).data as T;
    } on DioException catch (e) {
      final error = ApiException.from(e, offline: _ref.read(offlineProvider).value ?? false);
      if (kDebugMode) _ref.read(talkerProvider).handle(error, e.stackTrace);
      throw error;
    }
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) => _run(() => _dio.get(path, queryParameters: query));
  Future<dynamic> post(String path, [Object? body]) => _run(() => _dio.post(path, data: body, options: _mutation));
  Future<dynamic> patch(String path, [Object? body]) => _run(() => _dio.patch(path, data: body, options: _mutation));
  Future<dynamic> delete(String path, [Object? body]) => _run(() => _dio.delete(path, data: body, options: _mutation));

  Future<Map<String, dynamic>> auth(String path, Map<String, dynamic> body) => _run(() => _dio.post(path, data: body, options: Options(extra: {'auth': false})));

  Future<String> upload(File file, String kind) async {
    final form = FormData.fromMap({'kind': kind, 'file': await MultipartFile.fromFile(file.path)});
    final r = await _run<Map>(() => _dio.post('/media', data: form));
    return r['path'];
  }

  Future<Page<T>> page<T>(String path, T Function(Map<String, dynamic>) f, {Map<String, dynamic>? query}) async => Page.fromJson(await get(path, query: query), f);
  Future<List<T>> list<T>(String path, T Function(Map<String, dynamic>) f, {Map<String, dynamic>? query}) async =>
      ((await get(path, query: query)) as List).cast<Map<String, dynamic>>().map(f).toList();

  Future<void>? _warm;
  DateTime? _warmAt;
  // L'instance Render s'endort au bout de 15 min : un seul /health par processus, jamais attendu, erreurs avalées.
  Future<void> warmup() => _warm ??= _dio
      .get('/health', options: Options(receiveTimeout: const Duration(seconds: 90), extra: {'auth': false}))
      .then(_checkVersion, onError: (_, _) {})
      .whenComplete(() => _warmAt = DateTime.now());

  Future<void> _checkVersion(Response r) async {
    final min = r.data is Map ? r.data['min_version']?.toString() : null;
    if (min == null) return;
    updateRequired.value = versionBelow((await PackageInfo.fromPlatform()).version, min);
  }

  /// Retour d'arrière-plan : au-delà de 5 min l'instance a pu se rendormir, le ping repart.
  void warmupIfStale() {
    if (_warmAt == null || DateTime.now().difference(_warmAt!) <= const Duration(minutes: 5)) return;
    _warm = null;
    warmup();
  }
}

// Une écriture qui traîne 20 s a échoué : seules les lectures attendent le réveil de l'instance.
final _mutation = Options(receiveTimeout: const Duration(seconds: 20));

final apiProvider = Provider<Api>(Api.new);

/// Vrai quand le réveil du serveur dépasse 3 s : les écrans le disent sous leur squelette au lieu de le laisser nu.
final wakingProvider = StreamProvider<bool>((ref) async* {
  final ready = ref.read(apiProvider).warmup();
  if (await Future.any([ready.then((_) => true), Future<bool>.delayed(const Duration(seconds: 3), () => false)])) return;
  yield true;
  await ready;
  yield false;
});
