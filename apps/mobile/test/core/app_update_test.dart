import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/connectivity.dart';
import 'package:cpi_go/core/updates/app_update_controller.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Mise à jour de l'APK.
///
/// Trois défauts, tous du même genre : **la mise à jour passait avant le
/// travail**, dans une application dont la seule raison d'être est de saisir
/// hors ligne.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late SharedPreferences prefs;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    prefs = await SharedPreferences.getInstance();
  });

  ProviderContainer build({
    required HttpClientAdapter adapter,
    List<ConnectivityResult> interfaces = const <ConnectivityResult>[
      ConnectivityResult.wifi,
    ],
  }) {
    final ProviderContainer container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        connectivitySourceProvider.overrideWithValue(_FakeSource(interfaces)),
        appUpdateClientProvider.overrideWithValue(() {
          final Dio dio = Dio(BaseOptions(baseUrl: 'https://exemple.test'));
          dio.httpClientAdapter = adapter;
          return dio;
        }),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  test('un serveur muet ne retient pas l\'application au-delà de 3 s', () async {
    // L'écran de démarrage restait bloqué sur `checking` pendant tout le budget
    // `connect + receive` : vingt secondes sur un lien qui avale les paquets,
    // avant qu'une application HORS LIGNE PAR CONCEPTION ne consente à
    // s'ouvrir.
    final ProviderContainer container = build(adapter: _SilentAdapter());
    expect(
      container.read(appUpdateControllerProvider).status,
      AppUpdateStatus.checking,
    );

    await Future<void>.delayed(AppUpdateController.splashBudget * 1.5);

    final AppUpdateState state = container.read(appUpdateControllerProvider);
    expect(state.status, isNot(AppUpdateStatus.checking));
    expect(
      state.requiresPrompt,
      isFalse,
      reason: 'l\'application doit s\'ouvrir et laisser saisir',
    );
  });

  test('réseau coupé + release obligatoire en cache : la saisie reste possible', () async {
    // C'était l'impasse : `AppUpdateScreen` s'affichait sans aucune issue, et
    // le commercial derrière un portail captif ne pouvait plus enregistrer un
    // seul prospect.
    await prefs.setString(
      'cpi.android.release',
      jsonEncode(<String, Object?>{
        'forceUpdate': true,
        'versionName': '9.9.9',
        'versionCode': 999,
        'fileSize': 12000000,
        'sha256': 'abc',
        'downloadUrl': 'https://exemple.test/cpi.apk',
        'notes': null,
      }),
    );

    final ProviderContainer container = build(adapter: _FailingAdapter());
    container.read(appUpdateControllerProvider);
    await Future<void>.delayed(const Duration(milliseconds: 50));

    final AppUpdateState state = container.read(appUpdateControllerProvider);
    expect(state.status, AppUpdateStatus.unreachable);
    expect(
      state.requiresPrompt,
      isFalse,
      reason:
          '« je dois mettre à jour » et « je n\'ai pas pu demander » ne sont '
          'pas la même chose',
    );
  });

  test('sur données mobiles, l\'APK attend un accord explicite', () async {
    // L'écouteur de connectivité jetait son `ConnectivityResult` : plusieurs
    // mégaoctets partaient sur le forfait personnel du commercial, sans un mot,
    // et repartaient à chaque bascule Wi-Fi ↔ mobile.
    final ProviderContainer container = build(
      adapter: _AvailableAdapter(),
      interfaces: const <ConnectivityResult>[ConnectivityResult.mobile],
    );
    container.read(appUpdateControllerProvider);
    await Future<void>.delayed(const Duration(milliseconds: 50));

    final AppUpdateState state = container.read(appUpdateControllerProvider);
    expect(state.blocker, AppUpdateBlocker.meteredLink);
    expect(state.release?.versionName, '2.0.0');
    expect(
      state.localPath,
      isNull,
      reason: 'aucun octet ne doit être téléchargé sans accord',
    );
    expect(
      state.requiresPrompt,
      isTrue,
      reason: 'l\'accord se demande, donc l\'écran s\'affiche',
    );
  });

  test('aucune mise à jour disponible : rien ne s\'affiche', () async {
    final ProviderContainer container = build(adapter: _NothingAdapter());
    container.read(appUpdateControllerProvider);
    await Future<void>.delayed(const Duration(milliseconds: 50));

    final AppUpdateState state = container.read(appUpdateControllerProvider);
    expect(state.status, AppUpdateStatus.ready);
    expect(state.requiresPrompt, isFalse);
  });
}

class _FakeSource implements ConnectivitySource {
  const _FakeSource(this.interfaces);

  final List<ConnectivityResult> interfaces;

  @override
  Future<List<ConnectivityResult>> current() async => interfaces;

  @override
  Stream<List<ConnectivityResult>> changes() =>
      const Stream<List<ConnectivityResult>>.empty();
}

/// Un lien qui avale les paquets : la requête ne revient jamais.
class _SilentAdapter implements HttpClientAdapter {
  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) => Completer<ResponseBody>().future;
}

class _FailingAdapter implements HttpClientAdapter {
  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    throw DioException(
      requestOptions: options,
      type: DioExceptionType.connectionError,
    );
  }
}

class _AvailableAdapter implements HttpClientAdapter {
  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      jsonEncode(<String, Object?>{
        'available': true,
        'forceUpdate': false,
        'versionName': '2.0.0',
        'versionCode': 200,
        'fileSize': 12 * 1024 * 1024,
        'sha256': 'abc',
        'downloadUrl': 'https://exemple.test/cpi.apk',
      }),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>['application/json'],
      },
    );
  }
}

class _NothingAdapter implements HttpClientAdapter {
  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      jsonEncode(<String, Object?>{'available': false}),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>['application/json'],
      },
    );
  }
}
