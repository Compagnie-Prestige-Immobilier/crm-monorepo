import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:isolate';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../network/api_environment.dart';
import '../providers/app_providers.dart';
import '../providers/connectivity.dart';
import 'update_installer.dart';

enum AppUpdateStatus { checking, downloading, ready, error, unreachable }

enum AppUpdateBlocker { none, meteredLink, diskSpace, installPermission }

/// Ce que la mise à jour prend au travail en cours.
///
/// [warning] : un bandeau, la saisie continue. [blocking] : plus rien d'autre
/// que l'installation.
enum AppUpdateGate { none, warning, blocking }

/// Le délai laissé à un appareil qui apprend le plancher SANS pouvoir
/// télécharger. Passé ce délai, la saisie s'arrête même hors ligne : au-delà,
/// les fiches produites par une version que le serveur refuse ne partiront
/// jamais.
const Duration kAppUpdateGrace = Duration(hours: 72);

/// Marge au-dessus du poids de l'APK : `PackageInstaller` recopie le fichier
/// dans sa propre session avant de poser le paquet.
const double kAppUpdateDiskHeadroom = 1.2;

class AndroidRelease {
  const AndroidRelease({
    required this.forceUpdate,
    required this.versionName,
    required this.versionCode,
    required this.fileSize,
    required this.sha256,
    required this.downloadUrl,
    required this.notes,
    this.minVersionCode,
    this.signerSha256,
  });

  final bool forceUpdate;
  final String versionName;
  final int versionCode;
  final int fileSize;
  final String sha256;
  final String downloadUrl;
  final String? notes;

  /// Le plancher : en dessous, le serveur ne reçoit plus les fiches. `null`
  /// quand le serveur ne le publie pas — [forceUpdate] fait alors foi.
  final int? minVersionCode;

  /// Empreinte du certificat de signature attendu, vérifiée côté natif avant la
  /// pose. `null` : contrôle délégué à Android.
  final String? signerSha256;

  factory AndroidRelease.fromJson(Map<String, dynamic> json) {
    return AndroidRelease(
      forceUpdate: json['forceUpdate'] as bool? ?? true,
      versionName: json['versionName'] as String? ?? '',
      versionCode: (json['versionCode'] as num?)?.toInt() ?? 0,
      fileSize: (json['fileSize'] as num?)?.toInt() ?? 0,
      sha256: json['sha256'] as String? ?? '',
      downloadUrl: json['downloadUrl'] as String? ?? '',
      notes: json['notes'] as String?,
      minVersionCode: (json['minVersionCode'] as num?)?.toInt(),
      signerSha256: json['signerSha256'] as String?,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'forceUpdate': forceUpdate,
    'versionName': versionName,
    'versionCode': versionCode,
    'fileSize': fileSize,
    'sha256': sha256,
    'downloadUrl': downloadUrl,
    'notes': notes,
    'minVersionCode': minVersionCode,
    'signerSha256': signerSha256,
  };

  /// Vrai quand [build] est sous le plancher. Le serveur calcule déjà ce verdict
  /// dans `forceUpdate` ; `minVersionCode` permet de le recalculer hors ligne,
  /// sur la release gardée en cache.
  bool refuses(int build) {
    final int? floor = minVersionCode;
    if (floor != null) return build < floor;
    return forceUpdate;
  }
}

@immutable
class AppUpdateState {
  const AppUpdateState({
    required this.status,
    this.release,
    this.progress = 0,
    this.localPath,
    this.error,
    this.dismissed = false,
    this.blocker = AppUpdateBlocker.none,
    this.belowFloor = false,
    this.gate = AppUpdateGate.none,
    this.deadline,
    this.canInstall = true,
    this.missingBytes = 0,
  });

  const AppUpdateState.checking() : this(status: AppUpdateStatus.checking);

  final AppUpdateStatus status;
  final AndroidRelease? release;
  final double progress;
  final String? localPath;
  final String? error;
  final bool dismissed;
  final AppUpdateBlocker blocker;

  /// Cette version n'est plus reçue par le serveur.
  final bool belowFloor;

  final AppUpdateGate gate;

  /// Fin du délai de grâce, quand il court. Ce que le bandeau annonce.
  final DateTime? deadline;

  /// « Sources inconnues » accordée à CPI GO.
  final bool canInstall;

  /// Ce qu'il manque sur le disque pour tenir l'APK, en octets.
  final int missingBytes;

  /// Une mise à jour FACULTATIVE à proposer. Le blocage, lui, passe par [gate] :
  /// « je dois mettre à jour » et « je n'ai pas pu demander » ne sont pas la
  /// même chose.
  bool get requiresPrompt =>
      release != null &&
      !belowFloor &&
      !dismissed &&
      status != AppUpdateStatus.unreachable;

  bool get isBlocking => gate == AppUpdateGate.blocking;

  bool get isReady => status == AppUpdateStatus.ready && localPath != null;

  AppUpdateState copyWith({
    AppUpdateStatus? status,
    AndroidRelease? release,
    double? progress,
    String? localPath,
    String? error,
    bool? dismissed,
    AppUpdateBlocker? blocker,
    bool? belowFloor,
    AppUpdateGate? gate,
    DateTime? deadline,
    bool? canInstall,
    int? missingBytes,
    bool clearError = false,
  }) {
    return AppUpdateState(
      status: status ?? this.status,
      release: release ?? this.release,
      progress: progress ?? this.progress,
      localPath: localPath ?? this.localPath,
      error: clearError ? null : (error ?? this.error),
      dismissed: dismissed ?? this.dismissed,
      blocker: blocker ?? this.blocker,
      belowFloor: belowFloor ?? this.belowFloor,
      gate: gate ?? this.gate,
      deadline: deadline ?? this.deadline,
      canInstall: canInstall ?? this.canInstall,
      missingBytes: missingBytes ?? this.missingBytes,
    );
  }
}

final NotifierProvider<AppUpdateController, AppUpdateState>
appUpdateControllerProvider =
    NotifierProvider<AppUpdateController, AppUpdateState>(
      AppUpdateController.new,
    );

final Provider<Dio Function()> appUpdateClientProvider =
    Provider<Dio Function()>((Ref ref) {
      return () => Dio(
        BaseOptions(
          baseUrl: ApiEnvironment.baseUrl,
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 12),
          headers: <String, dynamic>{'Accept': 'application/json'},
        ),
      );
    });

class AppUpdateController extends Notifier<AppUpdateState> {
  static const Duration splashBudget = Duration(seconds: 3);

  static const String _releaseKey = 'cpi.android.release';
  static const String _floorSinceKey = 'cpi.android.floor_since';

  Timer? _splashDeadline;
  Timer? _graceDeadline;
  AppLifecycleListener? _lifecycle;
  bool _checking = false;

  @override
  AppUpdateState build() {
    ref.onDispose(_teardown);
    ref.listen<AsyncValue<List<ConnectivityResult>>>(
      connectivityTriggerProvider,
      (
        AsyncValue<List<ConnectivityResult>>? _,
        AsyncValue<List<ConnectivityResult>> next,
      ) {
        final List<ConnectivityResult>? results = next.value;
        if (results == null) return;
        unawaited(check(overMeteredLink: !isUnmeteredLink(results)));
      },
    );
    // Le retour au premier plan : entre deux, l'utilisateur a pu accorder
    // « sources inconnues » dans les réglages, ou le serveur a pu publier.
    _lifecycle = AppLifecycleListener(
      onResume: () {
        unawaited(refreshInstallPermission());
        unawaited(check());
      },
    );
    ref.read(updateInstallerProvider).onFailure(_onInstallFailed);
    _splashDeadline = Timer(splashBudget, _releaseSplash);
    unawaited(Future<void>.microtask(check));
    return const AppUpdateState.checking();
  }

  void _teardown() {
    _splashDeadline?.cancel();
    _graceDeadline?.cancel();
    _lifecycle?.dispose();
    _lifecycle = null;
  }

  void _releaseSplash() {
    if (!ref.mounted || state.status != AppUpdateStatus.checking) return;
    state = _withGate(
      const AppUpdateState(
        status: AppUpdateStatus.unreachable,
        error: 'Serveur de mise à jour injoignable ; vérification différée.',
      ),
    );
  }

  /// Rappelé par [SyncCoordinator] après un cycle abouti : le serveur vient de
  /// répondre, c'est le meilleur moment pour lui redemander le plancher.
  void recheckAfterSync() => unawaited(check());

  Future<void> check({bool? overMeteredLink}) async {
    if (_checking) return;
    _checking = true;
    final Dio dio = ref.read(appUpdateClientProvider)();
    try {
      final AndroidRelease? release = await _fetch(dio);
      if (!ref.mounted) return;
      if (release == null) {
        await _forgetFloor();
        if (!ref.mounted) return;
        state = const AppUpdateState(status: AppUpdateStatus.ready);
        return;
      }
      await _cacheRelease(release);
      await _apply(
        dio,
        release,
        online: true,
        overMeteredLink: overMeteredLink,
      );
    } on Object catch (error) {
      final AndroidRelease? cached = await _readCachedRelease();
      if (!ref.mounted) return;
      if (cached == null) {
        state = _withGate(
          AppUpdateState(
            status: AppUpdateStatus.unreachable,
            error: messageErreurReseau(error),
          ),
        );
        return;
      }
      await _apply(dio, cached, online: false, failure: messageErreurReseau(error));
    } finally {
      // Le verdict est tombé : le garde-fou du démarrage n'a plus rien à
      // libérer, et un minuteur armé pour rien retient l'application en test
      // comme il retiendrait un isolate.
      _splashDeadline?.cancel();
      _splashDeadline = null;
      dio.close(force: true);
      _checking = false;
    }
  }

  Future<AndroidRelease?> _fetch(Dio dio) async {
    final String build = ref.read(buildNumberProvider);
    final Response<dynamic> response = await dio.get<dynamic>(
      '/api/v1/app-updates/android/current',
      queryParameters: <String, String>{'versionCode': build},
    );
    final Map<String, dynamic> json = Map<String, dynamic>.from(
      response.data as Map,
    );
    if (json['available'] != true) return null;
    return AndroidRelease.fromJson(json);
  }

  /// La machine à états, en un seul endroit : ce que l'on sait du plancher, ce
  /// qu'il y a sur le disque et ce que le réseau permet.
  Future<void> _apply(
    Dio dio,
    AndroidRelease release, {
    required bool online,
    bool? overMeteredLink,
    String? failure,
  }) async {
    final bool belowFloor = release.refuses(_buildNumber());
    final DateTime? since = belowFloor ? await _rememberFloor() : null;
    if (!ref.mounted) return;

    final AppUpdateStatus base = online
        ? AppUpdateStatus.ready
        : AppUpdateStatus.unreachable;

    // Un APK déjà vérifié sur le disque tranche avant tout le reste : il n'y a
    // plus rien à attendre du réseau, seulement à installer.
    final String? ready = belowFloor ? await _verifiedApk(release) : null;
    if (!ref.mounted) return;
    if (ready != null) {
      state = _withGate(
        AppUpdateState(
          status: AppUpdateStatus.ready,
          release: release,
          localPath: ready,
          progress: 1,
          belowFloor: true,
          canInstall: state.canInstall,
        ),
        since: since,
      );
      unawaited(refreshInstallPermission());
      return;
    }

    if (!online) {
      state = _withGate(
        AppUpdateState(
          status: AppUpdateStatus.unreachable,
          release: release,
          error: failure,
          belowFloor: belowFloor,
        ),
        since: since,
      );
      return;
    }

    final bool metered =
        overMeteredLink ?? !isUnmeteredLink(await _interfaces());
    if (!ref.mounted) return;
    if (metered) {
      state = _withGate(
        AppUpdateState(
          status: base,
          release: release,
          blocker: AppUpdateBlocker.meteredLink,
          belowFloor: belowFloor,
        ),
        since: since,
      );
      return;
    }

    state = _withGate(
      AppUpdateState(
        status: AppUpdateStatus.downloading,
        release: release,
        belowFloor: belowFloor,
      ),
      since: since,
    );
    try {
      await _download(dio, release);
    } on Object catch (error) {
      // Un téléchargement raté n'est PAS toujours une absence de réseau : le
      // serveur a répondu au contrôle juste avant. Mais une coupure EN COURS de
      // transfert, elle, doit rendre l'écran au travail : sans cette relecture
      // de l'interface, l'écran bloquant restait planté sur un téléphone qui
      // venait de perdre le réseau, et il fallait appuyer sur « Réessayer ».
      final bool connecte = (await _interfaces()).any(
        (ConnectivityResult r) => r != ConnectivityResult.none,
      );
      if (!ref.mounted) return;
      state = _withGate(
        AppUpdateState(
          status: connecte
              ? AppUpdateStatus.error
              : AppUpdateStatus.unreachable,
          release: release,
          error: messageErreurReseau(error),
          belowFloor: belowFloor,
        ),
        since: since,
      );
    }
  }

  /// Le plancher est-il connu ? Depuis quand ? La réponse survit au
  /// redémarrage : c'est elle qui borne le délai de grâce hors ligne.
  Future<DateTime?> _rememberFloor() async {
    if (!ref.mounted) return null;
    final preferences = ref.read(sharedPreferencesProvider);
    final String? raw = preferences.getString(_floorSinceKey);
    final DateTime? known = raw == null ? null : DateTime.tryParse(raw);
    if (known != null) return known;
    final DateTime now = ref.read(clockProvider).now();
    await preferences.setString(_floorSinceKey, now.toIso8601String());
    return now;
  }

  Future<void> _forgetFloor() async {
    if (!ref.mounted) return;
    await ref.read(sharedPreferencesProvider).remove(_floorSinceKey);
  }

  AppUpdateState _withGate(AppUpdateState next, {DateTime? since}) {
    _graceDeadline?.cancel();
    _graceDeadline = null;
    if (!next.belowFloor) return next;

    if (next.isReady || next.status != AppUpdateStatus.unreachable) {
      return next.copyWith(gate: AppUpdateGate.blocking);
    }

    // Hors ligne : la saisie continue jusqu'à l'échéance, puis s'arrête.
    final DateTime now = ref.read(clockProvider).now();
    final DateTime deadline = (since ?? now).add(kAppUpdateGrace);
    if (!now.isBefore(deadline)) {
      return next.copyWith(gate: AppUpdateGate.blocking, deadline: deadline);
    }
    _graceDeadline = Timer(deadline.difference(now), () {
      if (!ref.mounted) return;
      state = state.copyWith(gate: AppUpdateGate.blocking);
    });
    return next.copyWith(gate: AppUpdateGate.warning, deadline: deadline);
  }

  int _buildNumber() => int.tryParse(ref.read(buildNumberProvider)) ?? 0;

  Future<List<ConnectivityResult>> _interfaces() async {
    try {
      return await ref.read(connectivitySourceProvider).current();
    } on Object {
      return const <ConnectivityResult>[];
    }
  }

  Future<void> downloadNow() async {
    state = state.copyWith(
      status: AppUpdateStatus.checking,
      blocker: AppUpdateBlocker.none,
    );
    await check(overMeteredLink: false);
  }

  Future<void> retry() async {
    state = const AppUpdateState.checking();
    await check();
  }

  void postpone() {
    if (state.belowFloor) return;
    state = state.copyWith(dismissed: true);
  }

  Future<void> refreshInstallPermission() async {
    try {
      final bool allowed = await ref.read(updateInstallerProvider).canInstall();
      if (!ref.mounted) return;
      state = state.copyWith(
        canInstall: allowed,
        blocker: allowed && state.blocker == AppUpdateBlocker.installPermission
            ? AppUpdateBlocker.none
            : null,
      );
    } on Object {
      // Un canal absent (test, plateforme hôte) ne doit pas fermer l'écran.
    }
  }

  Future<void> openInstallSettings() async {
    await ref.read(updateInstallerProvider).openUnknownSourcesSettings();
  }

  Future<void> install() async {
    final String? path = state.localPath;
    if (path == null) return;
    final UpdateInstaller installer = ref.read(updateInstallerProvider);
    if (!await installer.canInstall()) {
      if (!ref.mounted) return;
      state = state.copyWith(
        canInstall: false,
        blocker: AppUpdateBlocker.installPermission,
      );
      return;
    }
    try {
      await installer.install(
        path: path,
        signerSha256: state.release?.signerSha256,
      );
    } on Object catch (error) {
      if (!ref.mounted) return;
      state = state.copyWith(error: _installErrorText(error));
    }
  }

  void _onInstallFailed(String message) {
    if (!ref.mounted) return;
    state = state.copyWith(error: message);
  }

  String _installErrorText(Object error) {
    if (error is! PlatformException) return 'L\'installation a échoué.';
    return switch (error.code) {
      'APK_ABSENT' => 'Le fichier de mise à jour a disparu. Retéléchargez-le.',
      'INSTALL_NOT_ALLOWED' =>
        'Autorisez CPI GO à installer des applications, puis réessayez.',
      'SIGNER_MISMATCH' =>
        'Ce fichier n\'est pas signé par CPI : il a été refusé.',
      _ => installFailureMessage(null, error.message),
    };
  }

  Future<Directory> _updatesDirectory() async {
    final Directory root = await getApplicationSupportDirectory();
    final Directory updates = Directory(p.join(root.path, 'updates'));
    await updates.create(recursive: true);
    return updates;
  }

  String _apkName(AndroidRelease release) =>
      'cpi-go-${release.versionCode}.apk';

  /// Hacher l'APK dans un isolate séparé. Un APK CPI GO fait des dizaines de
  /// mégaoctets : le hacher sur l'isolate principal fige l'interface assez
  /// longtemps pour qu'Android affiche « CPI GO ne répond pas ».
  static Future<String> _digest(String path) => Isolate.run(() async {
    final Digest digest = await sha256.bind(File(path).openRead()).first;
    return digest.toString().toLowerCase();
  });

  /// L'APK de cette release, déjà sur le disque et dont l'empreinte correspond.
  Future<String?> _verifiedApk(AndroidRelease release) async {
    try {
      final Directory updates = await _updatesDirectory();
      final File file = File(p.join(updates.path, _apkName(release)));
      if (!file.existsSync()) return null;
      if (release.fileSize > 0 && file.lengthSync() != release.fileSize) {
        return null;
      }
      if (await _digest(file.path) != release.sha256.toLowerCase()) return null;
      return file.path;
    } on Object {
      return null;
    }
  }

  /// Les APK des versions précédentes : plusieurs dizaines de mégaoctets gardés
  /// pour rien sur un téléphone d'entrée de gamme.
  Future<void> _purgeStaleApks(Directory updates, String keep) async {
    try {
      await for (final FileSystemEntity entry in updates.list()) {
        if (entry is! File) continue;
        final String name = p.basename(entry.path);
        if (name == keep || !name.endsWith('.apk')) continue;
        await entry.delete();
      }
    } on Object {
      // Le ménage n'est pas la mise à jour : son échec ne l'arrête pas.
    }
  }

  Future<void> _download(Dio dio, AndroidRelease release) async {
    final Directory updates = await _updatesDirectory();
    final String name = _apkName(release);
    await _purgeStaleApks(updates, name);
    final File target = File(p.join(updates.path, name));
    final int onDisk = target.existsSync() ? target.lengthSync() : 0;
    // Un fichier déjà complet arrive ici parce que son empreinte a été refusée.
    // Demander `bytes=<taille>-` vaudrait un 416 à chaque essai : l'écran
    // bloquant n'aurait plus AUCUNE issue. On repart de zéro.
    final int existing = release.fileSize > 0 && onDisk >= release.fileSize
        ? 0
        : onDisk;

    final int missing = await _missingSpace(updates, release, existing);
    if (missing > 0) {
      if (!ref.mounted) return;
      state = state.copyWith(
        status: AppUpdateStatus.error,
        blocker: AppUpdateBlocker.diskSpace,
        missingBytes: missing,
      );
      return;
    }

    final Response<ResponseBody> response = await dio.get<ResponseBody>(
      release.downloadUrl,
      options: Options(
        responseType: ResponseType.stream,
        headers: <String, String>{
          if (existing > 0) 'Range': 'bytes=$existing-',
        },
        validateStatus: (int? status) => status == 200 || status == 206,
      ),
    );
    final bool append = existing > 0 && response.statusCode == 206;
    final RandomAccessFile output = await target.open(
      mode: append ? FileMode.append : FileMode.write,
    );
    int downloaded = append ? existing : 0;
    // Un APK de plusieurs dizaines de mégaoctets arrive en dizaines de milliers
    // de morceaux. Publier l'avancement à chaque morceau reconstruit l'écran
    // autant de fois et fige l'application : Android affiche « CPI GO ne
    // répond pas ». Le pour-cent affiché n'a besoin que de cent pas.
    int publie = -1;
    try {
      await for (final List<int> chunk in response.data!.stream) {
        await output.writeFrom(chunk);
        downloaded += chunk.length;
        if (!ref.mounted) return;
        final int pourCent = release.fileSize <= 0
            ? 0
            : downloaded * 100 ~/ release.fileSize;
        if (pourCent == publie) continue;
        publie = pourCent;
        state = state.copyWith(progress: pourCent / 100);
      }
    } finally {
      await output.close();
    }
    if (await _digest(target.path) != release.sha256.toLowerCase()) {
      await target.delete();
      throw StateError('La signature de la release ne correspond pas.');
    }
    if (!ref.mounted) return;
    state = _withGate(
      state.copyWith(
        status: AppUpdateStatus.ready,
        localPath: target.path,
        progress: 1,
        blocker: AppUpdateBlocker.none,
        clearError: true,
      ),
    );
    unawaited(refreshInstallPermission());
  }

  /// Ce qui manque pour tenir l'APK, marge d'installation comprise. Zéro quand
  /// la place est là — ou quand le système ne sait pas répondre : refuser une
  /// mise à jour obligatoire sur un chiffre absent serait pire.
  Future<int> _missingSpace(
    Directory updates,
    AndroidRelease release,
    int existing,
  ) async {
    if (release.fileSize <= 0) return 0;
    final int needed =
        (release.fileSize * kAppUpdateDiskHeadroom).ceil() - existing;
    if (needed <= 0) return 0;
    try {
      final int free = await ref
          .read(updateInstallerProvider)
          .freeSpaceBytes(updates.path);
      if (free <= 0) return 0;
      return needed > free ? needed - free : 0;
    } on Object {
      return 0;
    }
  }

  Future<void> _cacheRelease(AndroidRelease release) async {
    if (!ref.mounted) return;
    await ref
        .read(sharedPreferencesProvider)
        .setString(_releaseKey, jsonEncode(release.toJson()));
  }

  /// Lire le cache ne doit JAMAIS lever : cet appel se fait déjà depuis la
  /// branche d'erreur de [check], d'où une exception ressortirait en
  /// `unawaited` et emporterait l'application.
  Future<AndroidRelease?> _readCachedRelease() async {
    if (!ref.mounted) return null;
    try {
      final String? raw = ref
          .read(sharedPreferencesProvider)
          .getString(_releaseKey);
      if (raw == null) return null;
      return AndroidRelease.fromJson(
        Map<String, dynamic>.from(jsonDecode(raw) as Map),
      );
    } on Object {
      return null;
    }
  }
}

/// L'écran de mise à jour montre CE message : jamais la `DioException` brute,
/// qui affichait au terrain une page de trace en anglais.
String messageErreurReseau(Object error) {
  if (error is DioException) {
    final int? code = error.response?.statusCode;
    if (code == 429) {
      return 'Trop de téléchargements en ce moment. Réessayez dans quelques minutes.';
    }
    if (code != null && code >= 500) {
      return 'Le serveur de mise à jour est indisponible. Réessayez plus tard.';
    }
    const Set<DioExceptionType> reseau = <DioExceptionType>{
      DioExceptionType.connectionTimeout,
      DioExceptionType.sendTimeout,
      DioExceptionType.receiveTimeout,
      DioExceptionType.connectionError,
    };
    if (reseau.contains(error.type)) {
      return 'Connexion instable. Réessayez, de préférence en Wi-Fi.';
    }
  }
  return 'Le téléchargement a échoué. Réessayez.';
}
