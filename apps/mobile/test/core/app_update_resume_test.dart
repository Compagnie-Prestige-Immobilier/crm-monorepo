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

/// Reprise fiable du téléchargement de l'APK.
///
/// Le contrat (identique à celui du refonte Dart en cours) : le corps arrive
/// dans un `.part`, le fichier final n'apparaît QU'APRÈS un sha256 vérifié et un
/// renommage atomique. Une coupure laisse un `.part`, jamais de final ; la
/// reprise passe par `Range` ; l'intégrité est vérifiée avant le renommage.
///
/// Ces tests visent le CONTRAT, pas l'implémentation du jour : certains sont
/// rouges tant que la refonte `lib/` n'est pas intégrée. Voir le retour d'agent.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late SharedPreferences prefs;
  late Directory support;
  late FakeClock clock;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    prefs = await SharedPreferences.getInstance();
    support = Directory.systemTemp.createTempSync('cpi-resume-test');
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
    UpdateInstaller? installer,
  }) {
    final ProviderContainer container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        buildNumberProvider.overrideWithValue('1'),
        clockProvider.overrideWithValue(clock),
        updateInstallerProvider.overrideWithValue(installer ?? _FakeInstaller()),
        connectivitySourceProvider.overrideWithValue(
          _FakeSource(const <ConnectivityResult>[ConnectivityResult.wifi]),
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

  /// Démarre le contrôleur et rend la main dès que [fait] tient, ou au bout de
  /// [timeout]. La vérification d'empreinte tourne dans `Isolate.run` : on ne
  /// peut donc pas piloter ce cycle avec `fake_async`. Ce sondage borné remplace
  /// une attente fixe de plusieurs secondes.
  Future<AppUpdateState> settleUntil(
    ProviderContainer container,
    bool Function(AppUpdateState) fait, {
    Duration timeout = const Duration(seconds: 6),
  }) async {
    container.read(appUpdateControllerProvider);
    final DateTime limite = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(limite)) {
      await Future<void>.delayed(const Duration(milliseconds: 20));
      if (fait(container.read(appUpdateControllerProvider))) break;
    }
    return container.read(appUpdateControllerProvider);
  }

  /// Une release sous le plancher : le build local (1) est refusé, ce qui force
  /// le blocage puis le téléchargement.
  Map<String, Object?> refusee({required int fileSize, required String digest}) =>
      <String, Object?>{
        'available': true,
        'forceUpdate': true,
        'minVersionCode': 5,
        'versionName': '2.0.0',
        'versionCode': 5,
        'fileSize': fileSize,
        'sha256': digest,
        'downloadUrl': 'https://exemple.test/cpi.apk',
      };

  File finalApk() => File(p.join(support.path, 'updates', 'cpi-go-5.apk'));
  File partApk() => File(p.join(support.path, 'updates', 'cpi-go-5.apk.part'));

  test(
    'reprise après coupure : un .part reste, aucun final, la reprise passe par Range',
    () async {
      final List<int> plein = List<int>.filled(4096, 7);
      const int moitie = 2048;
      final _RangeAdapter adapter = _RangeAdapter(
        body: refusee(
          fileSize: plein.length,
          digest: sha256.convert(plein).toString(),
        ),
        full: plein,
        plan: <_Etape>[const _Coupe(moitie)],
      );
      final ProviderContainer container = build(adapter: adapter);

      // Juste après la coupure, avant la reprise : le contrat interdit tout
      // fichier final tant que le sha n'est pas vérifié. Seul le `.part` porte
      // les octets déjà reçus, et à la bonne longueur.
      await settleUntil(container, (AppUpdateState _) => partApk().existsSync());
      expect(
        finalApk().existsSync(),
        isFalse,
        reason: 'aucun final avant sha256 vérifié + renommage atomique',
      );
      expect(partApk().lengthSync(), moitie);

      await settleUntil(container, (AppUpdateState s) => s.isReady);
      final AppUpdateState pret = container.read(appUpdateControllerProvider);
      expect(pret.isReady, isTrue);
      expect(pret.localPath, endsWith('cpi-go-5.apk'));
      expect(finalApk().lengthSync(), plein.length);
      expect(
        partApk().existsSync(),
        isFalse,
        reason: 'le .part est renommé, pas laissé à côté du final',
      );
      expect(
        adapter.ranges,
        contains('bytes=$moitie-'),
        reason: 'la reprise repart de la longueur du .part, pas de zéro',
      );
    },
  );

  test(
    'le serveur ignore le Range (200 sur reprise) : le .part est tronqué et réécrit',
    () async {
      final List<int> plein = List<int>.filled(4096, 7);
      const int moitie = 2048;
      final _RangeAdapter adapter = _RangeAdapter(
        body: refusee(
          fileSize: plein.length,
          digest: sha256.convert(plein).toString(),
        ),
        full: plein,
        plan: <_Etape>[const _Coupe(moitie), const _IgnoreRange()],
      );
      final ProviderContainer container = build(adapter: adapter);

      final AppUpdateState apres = await settleUntil(
        container,
        (AppUpdateState s) =>
            s.status != AppUpdateStatus.checking &&
            s.status != AppUpdateStatus.downloading,
      );
      if (!apres.isReady) {
        await container.read(appUpdateControllerProvider.notifier).downloadNow();
      }
      await settleUntil(container, (AppUpdateState s) => s.isReady);

      expect(container.read(appUpdateControllerProvider).isReady, isTrue);
      expect(
        finalApk().lengthSync(),
        plein.length,
        reason: 'un 200 tronque le .part et réécrit depuis 0, il ne s\'ajoute pas',
      );
      expect(partApk().existsSync(), isFalse);
    },
  );

  test('416 sur reprise : le .part complet est vérifié et renommé, sans erreur', () async {
    final List<int> plein = List<int>.filled(4096, 7);
    Directory(p.join(support.path, 'updates')).createSync(recursive: true);
    partApk().writeAsBytesSync(plein); // .part déjà complet, jamais renommé

    final _RangeAdapter adapter = _RangeAdapter(
      body: refusee(
        fileSize: plein.length,
        digest: sha256.convert(plein).toString(),
      ),
      full: plein,
      plan: <_Etape>[const _Plage416()],
    );
    final ProviderContainer container = build(adapter: adapter);

    final AppUpdateState pret = await settleUntil(
      container,
      (AppUpdateState s) => s.isReady,
    );

    expect(pret.isReady, isTrue, reason: 'un 416 sur un .part complet n\'est pas une erreur');
    expect(pret.error, isNull);
    expect(finalApk().existsSync(), isTrue);
    expect(finalApk().lengthSync(), plein.length);
    expect(partApk().existsSync(), isFalse);
    expect(adapter.ranges, <String?>['bytes=${plein.length}-']);
  });

  test(
    'corruption récupérable : .part complet mais sha faux → supprimé, cycle propre → prêt',
    () async {
      final List<int> plein = List<int>.filled(4096, 7);
      final List<int> corrompu = List<int>.filled(4096, 0); // même taille, sha faux
      final _RangeAdapter adapter = _RangeAdapter(
        body: refusee(
          fileSize: plein.length,
          digest: sha256.convert(plein).toString(),
        ),
        full: plein,
        plan: <_Etape>[_Corrompu(corrompu), const _Complet()],
      );
      final ProviderContainer container = build(adapter: adapter);

      final AppUpdateState pret = await settleUntil(
        container,
        (AppUpdateState s) => s.isReady,
      );

      expect(pret.isReady, isTrue);
      expect(finalApk().lengthSync(), plein.length);
      expect(
        adapter.downloads,
        2,
        reason: 'exactement un cycle propre relancé après le .part corrompu',
      );
    },
  );

  test(
    'corruption persistante : deux .part faux → erreur, pas de boucle infinie',
    () async {
      final List<int> plein = List<int>.filled(4096, 7);
      final List<int> corrompu = List<int>.filled(4096, 0);
      final _RangeAdapter adapter = _RangeAdapter(
        body: refusee(
          fileSize: plein.length,
          digest: sha256.convert(plein).toString(),
        ),
        full: plein,
        plan: <_Etape>[_Corrompu(corrompu), _Corrompu(corrompu)],
      );
      final ProviderContainer container = build(adapter: adapter);

      final AppUpdateState fin = await settleUntil(
        container,
        (AppUpdateState s) => s.status == AppUpdateStatus.error,
      );

      expect(fin.status, AppUpdateStatus.error);
      expect(fin.isReady, isFalse);
      expect(
        adapter.downloads,
        lessThanOrEqualTo(2),
        reason: 'le cycle propre est relancé AU PLUS une fois',
      );
      expect(finalApk().existsSync(), isFalse);
    },
  );

  test(
    'backoff : deux erreurs transitoires puis succès → au plus 3 tentatives, reprises par Range',
    () async {
      // Le délai croissant du backoff n'est pas asservi ici : `clockProvider` ne
      // donne que l'heure, sans ordonnanceur, et `Isolate.run` de la vérification
      // interdit `fake_async`. On prouve donc l'OBSERVABLE : le nombre borné de
      // tentatives, la reprise Range à chaque fois (offsets croissants ⇒ le .part
      // n'est PAS supprimé sur erreur), et l'état prêt au bout.
      final List<int> plein = List<int>.filled(4096, 7);
      final _RangeAdapter adapter = _RangeAdapter(
        body: refusee(
          fileSize: plein.length,
          digest: sha256.convert(plein).toString(),
        ),
        full: plein,
        plan: <_Etape>[const _Coupe(1024), const _Coupe(2048), const _Complet()],
      );
      final ProviderContainer container = build(adapter: adapter);

      final AppUpdateState pret = await settleUntil(
        container,
        (AppUpdateState s) => s.isReady,
        timeout: const Duration(seconds: 10),
      );

      expect(pret.isReady, isTrue);
      expect(adapter.downloads, lessThanOrEqualTo(3));
      expect(adapter.ranges, <String?>[null, 'bytes=1024-', 'bytes=3072-']);
      expect(finalApk().lengthSync(), plein.length);
    },
  );

  test(
    'anti-boucle premier plan : un final intègre ne se retélécharge pas sur onResume',
    () async {
      final List<int> plein = List<int>.filled(4096, 7);
      Directory(p.join(support.path, 'updates')).createSync(recursive: true);
      finalApk().writeAsBytesSync(plein); // final déjà complet et intègre

      final _RangeAdapter adapter = _RangeAdapter(
        body: refusee(
          fileSize: plein.length,
          digest: sha256.convert(plein).toString(),
        ),
        full: plein,
      );
      final ProviderContainer container = build(adapter: adapter);

      await settleUntil(container, (AppUpdateState s) => s.isReady);
      expect(adapter.downloads, 0);

      TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(
        AppLifecycleState.inactive,
      );
      TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(
        AppLifecycleState.resumed,
      );
      await settleUntil(container, (AppUpdateState s) => s.isReady);

      expect(
        adapter.downloads,
        0,
        reason: 'aucun GET de téléchargement : le final intègre suffit',
      );
      expect(
        container.read(appUpdateControllerProvider).localPath,
        endsWith('cpi-go-5.apk'),
      );
    },
  );

  test(
    'survie processus : un .part trouvé au démarrage à froid est repris, pas recommencé',
    () async {
      final List<int> plein = List<int>.filled(4096, 7);
      const int moitie = 2048;
      Directory(p.join(support.path, 'updates')).createSync(recursive: true);
      partApk().writeAsBytesSync(plein.sublist(0, moitie)); // partiel pré-placé

      final _RangeAdapter adapter = _RangeAdapter(
        body: refusee(
          fileSize: plein.length,
          digest: sha256.convert(plein).toString(),
        ),
        full: plein,
      );
      // build() NEUF : premier `check()` du contrôleur, comme après un
      // redémarrage à froid.
      final ProviderContainer container = build(adapter: adapter);

      final AppUpdateState pret = await settleUntil(
        container,
        (AppUpdateState s) => s.isReady,
      );

      expect(pret.isReady, isTrue);
      expect(
        adapter.ranges.first,
        'bytes=$moitie-',
        reason: 'reprise depuis la longueur du .part, pas un redémarrage à 0',
      );
      expect(adapter.downloads, 1);
      expect(finalApk().lengthSync(), plein.length);
      expect(partApk().existsSync(), isFalse);
    },
  );

  test('disque plein : erreur diskSpace chiffrée, aucun .part écrit', () async {
    const int taille = 100 * 1024 * 1024;
    final _FakeInstaller installer = _FakeInstaller(freeSpace: 10 * 1024 * 1024);
    final _RangeAdapter adapter = _RangeAdapter(
      body: refusee(fileSize: taille, digest: 'peu-importe'),
      full: const <int>[],
    );
    final ProviderContainer container = build(
      adapter: adapter,
      installer: installer,
    );

    final AppUpdateState state = await settleUntil(
      container,
      (AppUpdateState s) =>
          s.blocker == AppUpdateBlocker.diskSpace ||
          s.status == AppUpdateStatus.error,
    );

    expect(state.blocker, AppUpdateBlocker.diskSpace);
    expect(state.missingBytes, greaterThan(0));
    expect(
      adapter.downloads,
      0,
      reason: 'rien ne part sur un disque qui ne peut pas tenir l\'APK',
    );
    final Directory updates = Directory(p.join(support.path, 'updates'));
    final List<FileSystemEntity> parts = updates.existsSync()
        ? updates
              .listSync()
              .where((FileSystemEntity e) => e.path.endsWith('.part'))
              .toList()
        : <FileSystemEntity>[];
    expect(parts, isEmpty, reason: 'le .part n\'est pas écrit au-delà du contrôle d\'espace');
  });
}

/// Sert le contrôle de version puis, sur l'URL de téléchargement, joue un [plan]
/// d'étapes — une par tentative — en honorant (ou non) l'en-tête `Range`. Chaque
/// en-tête `Range` reçu est enregistré, ce qui rend la reprise observable.
class _RangeAdapter implements HttpClientAdapter {
  _RangeAdapter({
    required this.body,
    required this.full,
    List<_Etape>? plan,
  }) : _plan = List<_Etape>.of(plan ?? const <_Etape>[]);

  final Map<String, Object?> body;
  final List<int> full;
  final List<_Etape> _plan;

  final List<String?> ranges = <String?>[];
  int downloads = 0;

  int _debut(String? range) {
    if (range == null) return 0;
    final Match? m = RegExp(r'bytes=(\d+)-').firstMatch(range);
    return m == null ? 0 : int.parse(m.group(1)!);
  }

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path == body['downloadUrl']) {
      final String? range = options.headers['Range'] as String?;
      ranges.add(range);
      final int start = _debut(range);
      final _Etape etape = downloads < _plan.length
          ? _plan[downloads]
          : const _Complet();
      downloads++;
      return etape.servir(full, start, options);
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

abstract interface class _Etape {
  ResponseBody servir(List<int> full, int start, RequestOptions options);
}

/// Livre [octets] octets depuis l'offset demandé, puis jette une erreur réseau :
/// le `.part` garde ces octets, la reprise doit repartir de là.
class _Coupe implements _Etape {
  const _Coupe(this.octets);

  final int octets;

  @override
  ResponseBody servir(List<int> full, int start, RequestOptions options) {
    final List<int> tranche = full.sublist(start, start + octets);
    return ResponseBody(_fluxCoupe(tranche, options), start > 0 ? 206 : 200);
  }
}

Stream<Uint8List> _fluxCoupe(List<int> tete, RequestOptions options) async* {
  yield Uint8List.fromList(tete);
  throw DioException(
    requestOptions: options,
    type: DioExceptionType.connectionError,
    error: const SocketException('coupure en cours de transfert'),
  );
}

/// Honore le Range : 206 depuis l'offset, ou 200 depuis 0.
class _Complet implements _Etape {
  const _Complet();

  @override
  ResponseBody servir(List<int> full, int start, RequestOptions options) =>
      ResponseBody.fromBytes(full.sublist(start), start > 0 ? 206 : 200);
}

/// Le serveur ignore le Range : corps entier depuis 0, en 200.
class _IgnoreRange implements _Etape {
  const _IgnoreRange();

  @override
  ResponseBody servir(List<int> full, int start, RequestOptions options) =>
      ResponseBody.fromBytes(full, 200);
}

/// Plage hors fichier : 416, comme un `.part` déjà complet qui redemande la suite.
class _Plage416 implements _Etape {
  const _Plage416();

  @override
  ResponseBody servir(List<int> full, int start, RequestOptions options) =>
      ResponseBody(const Stream<Uint8List>.empty(), 416);
}

/// Corps complet mais d'empreinte fausse : le renommage doit être refusé.
class _Corrompu implements _Etape {
  const _Corrompu(this.octets);

  final List<int> octets;

  @override
  ResponseBody servir(List<int> full, int start, RequestOptions options) =>
      ResponseBody.fromBytes(octets, 200);
}

class _FakeInstaller implements UpdateInstaller {
  _FakeInstaller({this.freeSpace = 1 << 40});

  final int freeSpace;

  @override
  Future<bool> canInstall() async => true;

  @override
  Future<int> freeSpaceBytes(String directory) async => freeSpace;

  @override
  Future<void> install({required String path, String? signerSha256}) async {}

  @override
  Future<void> openUnknownSourcesSettings() async {}

  @override
  void onFailure(void Function(String message) handler) {}
}

class _FakeSource implements ConnectivitySource {
  _FakeSource(this.interfaces);

  final List<ConnectivityResult> interfaces;

  @override
  Future<List<ConnectivityResult>> current() async => interfaces;

  @override
  Stream<List<ConnectivityResult>> changes() =>
      const Stream<List<ConnectivityResult>>.empty();
}
