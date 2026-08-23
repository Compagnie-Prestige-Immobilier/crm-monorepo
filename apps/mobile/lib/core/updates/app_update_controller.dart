import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../network/api_environment.dart';
import '../providers/app_providers.dart';
import '../providers/connectivity.dart';

enum AppUpdateStatus { checking, downloading, ready, error, unreachable }

enum AppUpdateBlocker { none, meteredLink }

class AndroidRelease {
  const AndroidRelease({
    required this.forceUpdate,
    required this.versionName,
    required this.versionCode,
    required this.fileSize,
    required this.sha256,
    required this.downloadUrl,
    required this.notes,
  });

  final bool forceUpdate;
  final String versionName;
  final int versionCode;
  final int fileSize;
  final String sha256;
  final String downloadUrl;
  final String? notes;

  factory AndroidRelease.fromJson(Map<String, dynamic> json) {
    return AndroidRelease(
      forceUpdate: json['forceUpdate'] as bool? ?? true,
      versionName: json['versionName'] as String? ?? '',
      versionCode: (json['versionCode'] as num?)?.toInt() ?? 0,
      fileSize: (json['fileSize'] as num?)?.toInt() ?? 0,
      sha256: json['sha256'] as String? ?? '',
      downloadUrl: json['downloadUrl'] as String? ?? '',
      notes: json['notes'] as String?,
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
  };
}

class AppUpdateState {
  const AppUpdateState({
    required this.status,
    this.release,
    this.progress = 0,
    this.localPath,
    this.error,
    this.dismissed = false,
    this.blocker = AppUpdateBlocker.none,
  });

  const AppUpdateState.checking() : this(status: AppUpdateStatus.checking);

  final AppUpdateStatus status;
  final AndroidRelease? release;
  final double progress;
  final String? localPath;
  final String? error;
  final bool dismissed;

  final AppUpdateBlocker blocker;

  bool get requiresPrompt =>
      release != null && !dismissed && status != AppUpdateStatus.unreachable;

  bool get isReady => status == AppUpdateStatus.ready && localPath != null;

  AppUpdateState copyWith({
    AppUpdateStatus? status,
    AndroidRelease? release,
    double? progress,
    String? localPath,
    String? error,
    bool? dismissed,
    AppUpdateBlocker? blocker,
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
  static const MethodChannel _installer = MethodChannel('sn.cpi.go/updates');

  static const Duration splashBudget = Duration(seconds: 3);

  Timer? _splashDeadline;
  bool _checking = false;

  @override
  AppUpdateState build() {
    ref.onDispose(() => _splashDeadline?.cancel());
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
    _splashDeadline = Timer(splashBudget, _releaseSplash);
    unawaited(Future<void>.microtask(check));
    return const AppUpdateState.checking();
  }

  void _releaseSplash() {
    if (!ref.mounted || state.status != AppUpdateStatus.checking) return;
    state = const AppUpdateState(
      status: AppUpdateStatus.unreachable,
      error: 'Serveur de mise à jour injoignable ; vérification différée.',
    );
  }

  Future<void> check({bool? overMeteredLink}) async {
    if (_checking) return;
    _checking = true;
    final Dio dio = ref.read(appUpdateClientProvider)();
    try {
      final String build = ref.read(buildNumberProvider);
      final Response<dynamic> response = await dio.get<dynamic>(
        '/api/v1/app-updates/android/current',
        queryParameters: <String, String>{'versionCode': build},
      );
      final Map<String, dynamic> json = Map<String, dynamic>.from(
        response.data as Map,
      );
      if (json['available'] != true) {
        if (ref.mounted) {
          state = const AppUpdateState(status: AppUpdateStatus.ready);
        }
        return;
      }
      final AndroidRelease release = AndroidRelease.fromJson(json);
      await _cacheRelease(release);

      final bool metered =
          overMeteredLink ?? !isUnmeteredLink(await _interfaces());
      if (metered) {
        if (!ref.mounted) return;
        state = AppUpdateState(
          status: AppUpdateStatus.ready,
          release: release,
          blocker: AppUpdateBlocker.meteredLink,
        );
        return;
      }

      if (!ref.mounted) return;
      state = AppUpdateState(
        status: AppUpdateStatus.downloading,
        release: release,
      );
      await _download(dio, release);
    } on Object catch (error) {
      final AndroidRelease? cached = await _readCachedRelease();
      if (!ref.mounted) return;
      state = AppUpdateState(
        status: AppUpdateStatus.unreachable,
        release: cached,
        error: '$error',
      );
    } finally {
      dio.close(force: true);
      _checking = false;
    }
  }

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
    if (state.release?.forceUpdate == true) return;
    state = state.copyWith(dismissed: true);
  }

  Future<void> install() async {
    final String? path = state.localPath;
    if (path == null) return;
    await _installer.invokeMethod<void>('installApk', <String, dynamic>{
      'path': path,
    });
  }

  Future<void> _download(Dio dio, AndroidRelease release) async {
    final Directory root = await getApplicationSupportDirectory();
    final Directory updates = Directory(p.join(root.path, 'updates'));
    await updates.create(recursive: true);
    final String path = p.join(
      updates.path,
      'cpi-go-${release.versionCode}.apk',
    );
    final File target = File(path);
    final int existing = target.existsSync() ? target.lengthSync() : 0;
    final Response<ResponseBody> response = await dio.get<ResponseBody>(
      release.downloadUrl,
      options: Options(
        responseType: ResponseType.stream,
        headers: <String, String>{
          if (existing > 0) 'Range': 'bytes=$existing-',
        },
        validateStatus: (status) => status == 200 || status == 206,
      ),
    );
    final bool append = existing > 0 && response.statusCode == 206;
    final int initial = append ? existing : 0;
    final RandomAccessFile output = await target.open(
      mode: append ? FileMode.append : FileMode.write,
    );
    int downloaded = initial;
    try {
      await for (final List<int> chunk in response.data!.stream) {
        await output.writeFrom(chunk);
        downloaded += chunk.length;
        state = state.copyWith(
          progress: release.fileSize == 0 ? 0 : downloaded / release.fileSize,
        );
      }
    } finally {
      await output.close();
    }
    final Digest digest = await sha256.bind(target.openRead()).first;
    if (digest.toString().toLowerCase() != release.sha256.toLowerCase()) {
      await target.delete();
      throw StateError('La signature de la release ne correspond pas.');
    }
    state = state.copyWith(
      status: AppUpdateStatus.ready,
      localPath: path,
      progress: 1,
    );
  }

  Future<void> _cacheRelease(AndroidRelease release) async {
    if (!ref.mounted) return;
    final preferences = ref.read(sharedPreferencesProvider);
    await preferences.setString(
      'cpi.android.release',
      jsonEncode(release.toJson()),
    );
  }

  Future<AndroidRelease?> _readCachedRelease() async {
    if (!ref.mounted) return null;
    final String? raw = ref
        .read(sharedPreferencesProvider)
        .getString('cpi.android.release');
    if (raw == null) return null;
    try {
      return AndroidRelease.fromJson(
        Map<String, dynamic>.from(jsonDecode(raw) as Map),
      );
    } on Object {
      return null;
    }
  }
}
