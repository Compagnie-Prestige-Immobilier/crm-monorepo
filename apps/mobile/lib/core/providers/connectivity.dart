import 'dart:async';
import 'dart:developer' as developer;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum CpiConnectivity {
  online,

  unreachable,

  offline,
}

const Duration kUnreachableFreshness = Duration(minutes: 3);

final NotifierProvider<UnreachableEvidence, DateTime?> unreachableEvidenceProvider =
    NotifierProvider<UnreachableEvidence, DateTime?>(UnreachableEvidence.new);

class UnreachableEvidence extends Notifier<DateTime?> {
  @override
  DateTime? build() => null;

  void record(DateTime at) => state = at;

  void clear() => state = null;
}

abstract interface class NetworkValidation {
  Future<bool?> isValidated();
}

class PlatformNetworkValidation implements NetworkValidation {
  const PlatformNetworkValidation();

  static const MethodChannel channel = MethodChannel('sn.cpi.go/network');

  @override
  Future<bool?> isValidated() async {
    try {
      return await channel.invokeMethod<bool>('isValidated');
    } on Object catch (error) {
      developer.log(
        'Verdict de validation réseau indisponible : $error',
        name: 'cpi.connectivity',
      );
      return null;
    }
  }
}

final Provider<NetworkValidation> networkValidationProvider =
    Provider<NetworkValidation>((Ref ref) => const PlatformNetworkValidation());

final FutureProvider<bool?> networkValidatedProvider = FutureProvider<bool?>((
  Ref ref,
) async {
  ref.watch(connectivityResultsProvider);
  return ref.watch(networkValidationProvider).isValidated();
});

abstract interface class ConnectivitySource {
  Future<List<ConnectivityResult>> current();

  Stream<List<ConnectivityResult>> changes();
}

class PlatformConnectivitySource implements ConnectivitySource {
  PlatformConnectivitySource([Connectivity? connectivity])
    : _connectivity = connectivity ?? Connectivity();

  final Connectivity _connectivity;

  @override
  Future<List<ConnectivityResult>> current() => _connectivity.checkConnectivity();

  @override
  Stream<List<ConnectivityResult>> changes() => _connectivity.onConnectivityChanged;
}

final Provider<ConnectivitySource> connectivitySourceProvider =
    Provider<ConnectivitySource>((Ref ref) => PlatformConnectivitySource());

const Duration kConnectivityDebounce = Duration(seconds: 2);

final StreamProvider<List<ConnectivityResult>> connectivityResultsProvider =
    StreamProvider<List<ConnectivityResult>>((Ref ref) async* {
      final ConnectivitySource source = ref.watch(connectivitySourceProvider);
      try {
        yield await source.current();
      } on Object catch (error) {
        developer.log(
          'État réseau initial indisponible sur cette plateforme : $error',
          name: 'cpi.connectivity',
        );
        yield const <ConnectivityResult>[ConnectivityResult.other];
      }
      yield* source.changes().handleError((Object error, StackTrace stack) {
        developer.log(
          'Événement réseau ignoré : $error',
          name: 'cpi.connectivity',
          stackTrace: stack,
        );
      });
    });

final StreamProvider<List<ConnectivityResult>> connectivityTriggerProvider =
    StreamProvider<List<ConnectivityResult>>((Ref ref) {
      final StreamController<List<ConnectivityResult>> out =
          StreamController<List<ConnectivityResult>>();
      Timer? debounce;
      ref.listen<AsyncValue<List<ConnectivityResult>>>(connectivityResultsProvider, (
        AsyncValue<List<ConnectivityResult>>? previous,
        AsyncValue<List<ConnectivityResult>> next,
      ) {
        final List<ConnectivityResult>? results = next.value;
        if (results == null || previous?.value == null) return;
        debounce?.cancel();
        debounce = Timer(kConnectivityDebounce, () {
          if (!out.isClosed) out.add(results);
        });
      });
      ref.onDispose(() {
        debounce?.cancel();
        unawaited(out.close());
      });
      return out.stream;
    });

final Provider<AsyncValue<CpiConnectivity>> connectivityInterfaceProvider =
    Provider<AsyncValue<CpiConnectivity>>(
      (Ref ref) => ref.watch(connectivityResultsProvider).whenData(_classify),
    );

bool isUnmeteredLink(List<ConnectivityResult> results) => results.any(
  (ConnectivityResult r) =>
      r == ConnectivityResult.wifi || r == ConnectivityResult.ethernet,
);

final Provider<CpiConnectivity> connectivityProvider = Provider<CpiConnectivity>((
  Ref ref,
) {
  final CpiConnectivity interface =
      ref.watch(connectivityInterfaceProvider).value ?? CpiConnectivity.online;
  if (interface == CpiConnectivity.offline) return CpiConnectivity.offline;

  final bool? validated = ref.watch(networkValidatedProvider).value;
  if (validated == false) return CpiConnectivity.unreachable;

  final DateTime? failedAt = ref.watch(unreachableEvidenceProvider);
  if (failedAt == null) return CpiConnectivity.online;
  final Duration age = DateTime.now().difference(failedAt);
  return age.isNegative || age > kUnreachableFreshness
      ? CpiConnectivity.online
      : CpiConnectivity.unreachable;
});

CpiConnectivity _classify(List<ConnectivityResult> results) {
  final bool hasInterface = results.any(
    (ConnectivityResult r) => r != ConnectivityResult.none,
  );
  return hasInterface ? CpiConnectivity.online : CpiConnectivity.offline;
}
