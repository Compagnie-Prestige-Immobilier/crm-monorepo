import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/connectivity.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/updates/app_update_controller.dart';
import 'package:cpi_go/core/updates/update_installer.dart';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart' show AppLifecycleState;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';

/// Mise à jour de l'APK.
///
/// Trois défauts, tous du même genre : **la mise à jour passait avant le
/// travail**, dans une application dont la seule raison d'être est de saisir
/// hors ligne.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late SharedPreferences prefs;
  late Directory support;
  late FakeClock clock;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    prefs = await SharedPreferences.getInstance();
    support = Directory.systemTemp.createTempSync('cpi-updates-test');
    addTearDown(() => support.deleteSync(recursive: true));
    clock = FakeClock(DateTime.utc(2026, 8, 27, 8));
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/path_provider'),
          (MethodCall call) async => support.path,
        );
  });

  ProviderContainer build({
    required HttpClientAdapter adapter,
    List<ConnectivityResult> interfaces = const <ConnectivityResult>[
      ConnectivityResult.wifi,
    ],
    String buildNumber = '1',
    UpdateInstaller? installer,
    ConnectivitySource? source,
  }) {
    final ProviderContainer container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        appUpdateRetryDelaysProvider.overrideWithValue(
          const <Duration>[Duration.zero, Duration.zero, Duration.zero],
        ),
        buildNumberProvider.overrideWithValue(buildNumber),
        clockProvider.overrideWithValue(clock),
        updateInstallerProvider.overrideWithValue(
          installer ?? _FakeInstaller(),
        ),
        connectivitySourceProvider.overrideWithValue(
          source ?? _FakeSource(interfaces),
        ),
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

  /// Large : la vérification d'empreinte passe par `Isolate.run`, dont le
  /// démarrage coûte plus que le reste du cycle.
  Future<AppUpdateState> settle(ProviderContainer container) async {
    container.read(appUpdateControllerProvider);
    await Future<void>.delayed(const Duration(milliseconds: 600));
    return container.read(appUpdateControllerProvider);
  }

  /// Une release refusée par le serveur : le plancher est au-dessus du build
  /// local. `minVersionCode` permet de le REcalculer hors ligne, sur le cache.
  Map<String, Object?> refusee({
    int versionCode = 5,
    int fileSize = 0,
    String digest = 'abc',
  }) => <String, Object?>{
    'available': true,
    'forceUpdate': true,
    'minVersionCode': versionCode,
    'versionName': '2.0.0',
    'versionCode': versionCode,
    'fileSize': fileSize,
    'sha256': digest,
    'downloadUrl': 'https://exemple.test/cpi.apk',
  };

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

  test(
    'réseau coupé + release obligatoire en cache : la saisie reste possible',
    () async {
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
      await Future<void>.delayed(const Duration(milliseconds: 150));

      final AppUpdateState state = container.read(appUpdateControllerProvider);
      expect(state.status, AppUpdateStatus.unreachable);
      expect(
        state.requiresPrompt,
        isFalse,
        reason:
            '« je dois mettre à jour » et « je n\'ai pas pu demander » ne sont '
            'pas la même chose',
      );
    },
  );

  test('sur données mobiles, l\'APK attend un accord explicite', () async {
    // L'écouteur de connectivité jetait son `ConnectivityResult` : plusieurs
    // mégaoctets partaient sur le forfait personnel du commercial, sans un mot,
    // et repartaient à chaque bascule Wi-Fi ↔ mobile.
    final ProviderContainer container = build(
      adapter: _AvailableAdapter(),
      interfaces: const <ConnectivityResult>[ConnectivityResult.mobile],
    );
    container.read(appUpdateControllerProvider);
    await Future<void>.delayed(const Duration(milliseconds: 150));

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
    await Future<void>.delayed(const Duration(milliseconds: 150));

    final AppUpdateState state = container.read(appUpdateControllerProvider);
    expect(state.status, AppUpdateStatus.ready);
    expect(state.requiresPrompt, isFalse);
  });

  group('la porte', () {
    test('plancher inconnu : rien ne bloque', () async {
      // Le serveur propose une version de plus, sans dire qu'il refuse
      // celle-ci. Proposer n'est pas condamner.
      final AppUpdateState state = await settle(
        build(
          adapter: _JsonAdapter(<String, Object?>{
            'available': true,
            'forceUpdate': false,
            'versionName': '2.0.0',
            'versionCode': 5,
            'fileSize': 0,
            'sha256': '',
            'downloadUrl': 'https://exemple.test/cpi.apk',
          }),
        ),
      );
      expect(state.belowFloor, isFalse);
      expect(state.gate, AppUpdateGate.none);
    });

    test(
      'plancher connu + réseau : blocage, téléchargement, APK vérifié',
      () async {
        final List<int> bytes = List<int>.filled(2048, 3);
        final AppUpdateState state = await settle(
          build(
            adapter: _JsonAdapter(
              refusee(
                fileSize: bytes.length,
                digest: sha256.convert(bytes).toString(),
              ),
              apk: bytes,
            ),
          ),
        );
        expect(state.belowFloor, isTrue);
        expect(state.gate, AppUpdateGate.blocking);
        expect(state.isReady, isTrue);
        expect(File(state.localPath!).lengthSync(), bytes.length);
      },
    );

    test(
      'plancher connu + hors ligne : la saisie continue, l\'échéance est dite',
      () async {
        await prefs.setString(
          'cpi.android.release',
          jsonEncode(refusee()..remove('available')),
        );

        final AppUpdateState state = await settle(
          build(adapter: _FailingAdapter()),
        );
        expect(state.status, AppUpdateStatus.unreachable);
        expect(state.belowFloor, isTrue);
        expect(state.gate, AppUpdateGate.warning);
        expect(state.deadline, clock.now().add(kAppUpdateGrace));
      },
    );

    test('plancher connu + hors ligne + grâce écoulée : blocage', () async {
      await prefs.setString(
        'cpi.android.release',
        jsonEncode(refusee()..remove('available')),
      );
      // Le plancher est connu depuis avant-hier : le délai est passé.
      await prefs.setString(
        'cpi.android.floor_since',
        clock
            .now()
            .subtract(kAppUpdateGrace + const Duration(hours: 1))
            .toIso8601String(),
      );

      final AppUpdateState state = await settle(
        build(adapter: _FailingAdapter()),
      );
      expect(state.gate, AppUpdateGate.blocking);
    });

    test(
      'plancher connu + APK vérifié sur disque : blocage dur, prêt à poser',
      () async {
        final ({int size, String digest}) apk = await _poserApk(support, 5);
        await prefs.setString(
          'cpi.android.release',
          jsonEncode(
            refusee(fileSize: apk.size, digest: apk.digest)
              ..remove('available'),
          ),
        );

        // Hors ligne, et pourtant bloquant : il n'y a plus rien à attendre du
        // réseau, seulement à installer.
        final AppUpdateState state = await settle(
          build(adapter: _FailingAdapter()),
        );
        expect(state.gate, AppUpdateGate.blocking);
        expect(state.isReady, isTrue);
        expect(state.localPath, endsWith('cpi-go-5.apk'));
      },
    );
  });

  test(
    'réseau coupé PENDANT le téléchargement : l\'écran rend la main',
    () async {
      // Le contrôle avait abouti : sans relire l'interface, l'échec du
      // transfert laissait un blocage dur sur un téléphone hors ligne.
      final _FakeSource source = _FakeSource(<ConnectivityResult>[
        ConnectivityResult.wifi,
      ]);
      final AppUpdateState state = await settle(
        build(
          source: source,
          adapter: _JsonAdapter(
            refusee(fileSize: 2048),
            coupeLeTransfert: true,
            auTelechargement: () => source.interfaces = <ConnectivityResult>[
              ConnectivityResult.none,
            ],
          ),
        ),
      );
      expect(state.status, AppUpdateStatus.unreachable);
      expect(state.gate, AppUpdateGate.warning);
    },
  );

  test('un APK complet mais corrompu se retélécharge en entier', () async {
    // Le piège : `Range: bytes=<taille>-` sur un fichier déjà complet vaut un
    // 416 à chaque essai, et l'écran bloquant n'a plus la moindre issue.
    final List<int> bytes = List<int>.filled(2048, 3);
    Directory(p.join(support.path, 'updates')).createSync(recursive: true);
    File(
      p.join(support.path, 'updates', 'cpi-go-5.apk'),
    ).writeAsBytesSync(List<int>.filled(bytes.length, 0));

    final _JsonAdapter adapter = _JsonAdapter(
      refusee(fileSize: bytes.length, digest: sha256.convert(bytes).toString()),
      apk: bytes,
    );
    final AppUpdateState state = await settle(build(adapter: adapter));

    expect(state.isReady, isTrue);
    expect(
      adapter.rangeDemande,
      isNull,
      reason: 'aucune reprise possible : le téléchargement repart de zéro',
    );
  });

  test(
    'un APK complet et intègre déjà sur disque passe prêt sans se retélécharger',
    () async {
      // La boucle d'installation : ouvrir la confirmation met CPI GO en
      // arrière-plan, `onResume` relance `check()`, et l'ancien code
      // retéléchargeait le fichier complet depuis zéro, si bien que l'install ne
      // se posait jamais. L'adaptateur ne sert AUCUN octet d'APK valide : un
      // retéléchargement échouerait l'empreinte, donc « prêt » ne peut venir que
      // du fichier déjà sur disque.
      final List<int> bytes = List<int>.filled(2048, 7);
      Directory(p.join(support.path, 'updates')).createSync(recursive: true);
      final File apk = File(p.join(support.path, 'updates', 'cpi-go-5.apk'))
        ..writeAsBytesSync(bytes);

      final _JsonAdapter adapter = _JsonAdapter(
        refusee(
          fileSize: bytes.length,
          digest: sha256.convert(bytes).toString(),
        ),
      );
      final AppUpdateState state = await settle(build(adapter: adapter));

      expect(state.isReady, isTrue);
      expect(state.localPath, endsWith('cpi-go-5.apk'));
      expect(apk.existsSync(), isTrue);
      expect(
        adapter.rangeDemande,
        isNull,
        reason: 'le corps du téléchargement n\'a pas été redemandé',
      );
    },
  );

  test(
    'espace insuffisant : le manque est chiffré, rien n\'est écrit',
    () async {
      const int taille = 100 * 1024 * 1024;
      final _FakeInstaller installer = _FakeInstaller(
        freeSpace: 10 * 1024 * 1024,
      );
      final AppUpdateState state = await settle(
        build(
          adapter: _JsonAdapter(refusee(fileSize: taille)),
          installer: installer,
        ),
      );

      expect(state.blocker, AppUpdateBlocker.diskSpace);
      expect(
        state.missingBytes,
        (taille * kAppUpdateDiskHeadroom).ceil() - 10 * 1024 * 1024,
      );
      expect(
        Directory(p.join(support.path, 'updates')).listSync(),
        isEmpty,
        reason: 'aucun octet ne part sur un disque plein',
      );
    },
  );

  test(
    '« sources inconnues » révoquée : l\'installation renvoie aux réglages',
    () async {
      final ({int size, String digest}) apk = await _poserApk(support, 5);
      await prefs.setString(
        'cpi.android.release',
        jsonEncode(
          refusee(fileSize: apk.size, digest: apk.digest)..remove('available'),
        ),
      );
      final _FakeInstaller installer = _FakeInstaller(allowed: false);
      final ProviderContainer container = build(
        adapter: _FailingAdapter(),
        installer: installer,
      );
      await settle(container);

      await container.read(appUpdateControllerProvider.notifier).install();

      final AppUpdateState state = container.read(appUpdateControllerProvider);
      expect(state.canInstall, isFalse);
      expect(state.blocker, AppUpdateBlocker.installPermission);
      expect(installer.installed, isEmpty, reason: 'rien n\'a été posé');
    },
  );

  test('le retour au premier plan revérifie l\'autorisation', () async {
    final _FakeInstaller installer = _FakeInstaller(allowed: false);
    final ProviderContainer container = build(
      adapter: _NothingAdapter(),
      installer: installer,
    );
    await settle(container);
    expect(container.read(appUpdateControllerProvider).canInstall, isTrue);

    // L'utilisateur est allé dans les réglages et a accordé la permission.
    installer.allowed = true;
    TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(
      AppLifecycleState.inactive,
    );
    TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(
      AppLifecycleState.resumed,
    );
    await Future<void>.delayed(const Duration(milliseconds: 150));

    expect(container.read(appUpdateControllerProvider).canInstall, isTrue);
    expect(installer.permissionChecks, greaterThan(0));
  });
}

/// Écrit un APK factice là où le contrôleur ira le chercher, et rend sa taille
/// et son empreinte.
Future<({int size, String digest})> _poserApk(
  Directory support,
  int versionCode,
) async {
  final Directory updates = Directory(p.join(support.path, 'updates'))
    ..createSync(recursive: true);
  final List<int> bytes = List<int>.filled(4096, 7);
  final File file = File(p.join(updates.path, 'cpi-go-$versionCode.apk'))
    ..writeAsBytesSync(bytes);
  return (size: file.lengthSync(), digest: sha256.convert(bytes).toString());
}

class _FakeInstaller implements UpdateInstaller {
  _FakeInstaller({this.allowed = true, this.freeSpace = 1 << 40});

  bool allowed;
  final int freeSpace;
  final List<String> installed = <String>[];
  int permissionChecks = 0;

  @override
  Future<bool> canInstall() async {
    permissionChecks++;
    return allowed;
  }

  @override
  Future<int> freeSpaceBytes(String directory) async => freeSpace;

  @override
  Future<void> install({required String path, String? signerSha256}) async {
    installed.add(path);
  }

  @override
  Future<void> openUnknownSourcesSettings() async {}

  @override
  void onFailure(void Function(String message) handler) {}
}

/// Le contrôle rend [body] ; l'URL de téléchargement rend [apk] quand il est
/// fourni, pour que l'empreinte annoncée puisse réellement être vérifiée.
class _JsonAdapter implements HttpClientAdapter {
  _JsonAdapter(
    this.body, {
    this.apk,
    this.coupeLeTransfert = false,
    this.auTelechargement,
  });

  final void Function()? auTelechargement;

  final Map<String, Object?> body;
  final List<int>? apk;

  /// Le transfert s'interrompt en cours de flux, comme un mode avion activé
  /// pendant le téléchargement.
  final bool coupeLeTransfert;

  /// L'en-tête `Range` du dernier téléchargement, ou `null` s'il n'y en a pas eu.
  String? rangeDemande;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path == body['downloadUrl']) {
      rangeDemande = options.headers['Range'] as String?;
      auTelechargement?.call();
      if (coupeLeTransfert) {
        return ResponseBody(
          Stream<Uint8List>.error(
            const SocketException('Connection closed while receiving data'),
          ),
          200,
        );
      }
      final List<int>? bytes = apk;
      if (bytes != null) return ResponseBody.fromBytes(bytes, 200);
    }
    return ResponseBody.fromString(
      jsonEncode(body),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>['application/json'],
      },
    );
  }
}

class _FakeSource implements ConnectivitySource {
  _FakeSource(this.interfaces);

  /// Mutable : un test coupe le réseau EN COURS de téléchargement.
  List<ConnectivityResult> interfaces;

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
