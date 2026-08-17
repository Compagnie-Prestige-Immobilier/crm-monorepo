import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../background/background_sync.dart';
import '../sync/api_port.dart';
import '../sync/sync_engine.dart';
import 'app_providers.dart';
import 'connectivity.dart';

@immutable
class SyncUiState {
  const SyncUiState({
    this.running = false,
    this.lastRunAt,
    this.lastError,
    this.lastErrorKind,
    this.lastPushed = 0,
  });

  final bool running;
  final DateTime? lastRunAt;

  final String? lastError;

  final FailureKind? lastErrorKind;

  final int lastPushed;

  String? get failureLabel {
    final String? code = lastError;
    if (code == null) return null;
    return switch (lastErrorKind) {
      FailureKind.unreachable =>
        'Réseau injoignable. Vérifiez le portail Wi-Fi ou votre crédit data.',
      FailureKind.throttled =>
        'Le serveur limite les envois. La file repartira toute seule.',
      FailureKind.sessionExpired => 'Session expirée. Reconnectez-vous pour envoyer.',
      FailureKind.idempotencyInProgress =>
        'Un envoi précédent est encore en cours de traitement.',
      FailureKind.retryable => 'Le serveur a répondu en erreur ($code). Nouvel essai à venir.',
      FailureKind.terminal =>
        'Le serveur a refusé cet envoi ($code). Ouvrez « À corriger ».',
      null => 'Envoi impossible ($code).',
    };
  }

  SyncUiState copyWith({
    bool? running,
    DateTime? lastRunAt,
    String? lastError,
    FailureKind? lastErrorKind,
    bool clearError = false,
    int? lastPushed,
  }) {
    return SyncUiState(
      running: running ?? this.running,
      lastRunAt: lastRunAt ?? this.lastRunAt,
      lastError: clearError ? null : (lastError ?? this.lastError),
      lastErrorKind: clearError ? null : (lastErrorKind ?? this.lastErrorKind),
      lastPushed: lastPushed ?? this.lastPushed,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SyncUiState &&
          other.running == running &&
          other.lastRunAt == lastRunAt &&
          other.lastError == lastError &&
          other.lastErrorKind == lastErrorKind &&
          other.lastPushed == lastPushed;

  @override
  int get hashCode =>
      Object.hash(running, lastRunAt, lastError, lastErrorKind, lastPushed);
}

class SyncCoordinator extends Notifier<SyncUiState> {
  static const Duration foregroundPeriod = Duration(seconds: 60);

  Timer? _periodic;
  AppLifecycleListener? _lifecycle;
  bool _observing = false;

  @override
  SyncUiState build() {
    ref.onDispose(_teardown);
    ref.listen<AsyncValue<List<ConnectivityResult>>>(connectivityTriggerProvider, (
      AsyncValue<List<ConnectivityResult>>? _,
      AsyncValue<List<ConnectivityResult>> next,
    ) {
      if (next.value == null) return;
      unawaited(run(pull: false));
    });
    Future<void>.microtask(_start);
    return const SyncUiState();
  }

  void _start() {
    if (_observing) return;
    _observing = true;
    _lifecycle = AppLifecycleListener(
      onResume: () {
        _startPeriodic();
        unawaited(run());
      },
      onPause: () {
        _periodic?.cancel();
        _periodic = null;
        unawaited(_scheduleCatchUp());
      },
    );
    _startPeriodic();
    unawaited(run());
  }

  void _startPeriodic() {
    _periodic?.cancel();
    _periodic = Timer.periodic(foregroundPeriod, (Timer _) => run());
  }

  void _teardown() {
    _periodic?.cancel();
    _periodic = null;
    _lifecycle?.dispose();
    _lifecycle = null;
    _observing = false;
  }

  bool get isPolling => _periodic?.isActive ?? false;

  void nudge() => unawaited(run(pull: false));

  Future<SyncOutcome> run({bool pull = true}) async {
    final SyncEngine engine = ref.read(syncEngineProvider);
    if (engine.isBusy) {
      return const SyncOutcome.skipped('already_running');
    }
    state = state.copyWith(running: true, clearError: true);
    try {
      final SyncOutcome outcome = await engine.runOnce(pull: pull);
      state = state.copyWith(
        running: false,
        lastRunAt: DateTime.now(),
        lastPushed: outcome.pushed,
        lastError: outcome.status == SyncRunStatus.failed ? outcome.reason : null,
        lastErrorKind: outcome.status == SyncRunStatus.failed ? outcome.kind : null,
        clearError: outcome.status != SyncRunStatus.failed,
      );
      if (outcome.kind == FailureKind.sessionExpired) {
        ref.read(authControllerProvider.notifier).onSessionExpired();
      }
      _recordReachability(outcome);
      return outcome;
    } on Object catch (e) {
      state = state.copyWith(
        running: false,
        lastRunAt: DateTime.now(),
        lastError: e.toString(),
        lastErrorKind: FailureKind.retryable,
      );
      return SyncOutcome.failed('unexpected', kind: FailureKind.retryable);
    }
  }

  void _recordReachability(SyncOutcome outcome) {
    final UnreachableEvidence evidence = ref.read(
      unreachableEvidenceProvider.notifier,
    );
    if (outcome.kind == FailureKind.unreachable) {
      evidence.record(DateTime.now());
      return;
    }
    if (outcome.status != SyncRunStatus.skipped) evidence.clear();
  }

  Future<void> _scheduleCatchUp() async {
    final int schedulable = await ref.read(syncEngineProvider).schedulableCount();
    if (schedulable <= 0) return;
    await BackgroundSync.enqueueCatchUp();
  }
}
