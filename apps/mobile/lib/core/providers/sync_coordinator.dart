import 'dart:async';
import 'dart:developer' as developer;

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
      FailureKind.sessionExpired =>
        'Session expirée. Reconnectez-vous pour envoyer.',
      FailureKind.idempotencyInProgress =>
        'Un envoi précédent est encore en cours de traitement.',
      FailureKind.retryable =>
        'Le serveur a répondu en erreur ($code). Nouvel essai à venir.',
      FailureKind.terminal =>
        'Le serveur a refusé cet envoi ($code). Ouvrez « À corriger ».',
      FailureKind.appUpdateRequired =>
        'Cette version ne reçoit plus les fiches. Vos saisies partent toujours : '
            'installez la mise à jour.',
      null => 'Envoi impossible ($code).',
    };
  }

  /// Le serveur a fermé la DESCENTE à cet APK (426). Distinct d'un refus : rien
  /// ne se corrigera dans « À corriger », il faut mettre à jour.
  bool get requiresAppUpdate => lastErrorKind == FailureKind.appUpdateRequired;

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

  /// L'annuaire complet fait plusieurs centaines de milliers de lignes. Le
  /// borner par cycle étale le premier remplissage au lieu de bloquer une
  /// synchronisation entière : le curseur reprend là où il s'est arrêté.
  static const int directoryPagesPerRun = 3;

  Timer? _periodic;
  AppLifecycleListener? _lifecycle;
  bool _observing = false;

  @override
  SyncUiState build() {
    ref.onDispose(_teardown);
    // Un auditeur permanent sur le verdict réseau. Sans lui il n'est écouté que
    // par les écrans : il se périme dès qu'aucun ne l'affiche, puis se recalcule
    // en cascade pendant le `build` du suivant — que Riverpod 3.3 sanctionne
    // d'un `markNeedsBuild` en pleine phase de construction.
    ref.listen<CpiConnectivity>(
      connectivityProvider,
      (CpiConnectivity? _, CpiConnectivity _) {},
    );
    // Android soupçonne le lien mort : la seule façon d'en avoir le cœur net est
    // d'essayer. Le verdict lui-même n'allume aucune bande, c'est l'issue de ce
    // cycle qui tranche.
    ref.listen<AsyncValue<bool?>>(networkValidatedProvider, (
      AsyncValue<bool?>? _,
      AsyncValue<bool?> next,
    ) {
      if (next.value == false) unawaited(run(pull: false));
    });
    ref.listen<AsyncValue<List<ConnectivityResult>>>(
      connectivityTriggerProvider,
      (
        AsyncValue<List<ConnectivityResult>>? _,
        AsyncValue<List<ConnectivityResult>> next,
      ) {
        if (next.value == null) return;
        unawaited(run(pull: false));
      },
    );
    scheduleMicrotask(_start);
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
      // Une déconnexion, ou la fin d'un écran, peut jeter le fournisseur
      // pendant que le cycle attend le réseau. Écrire son état après coup lève,
      // et l'erreur ressort d'un `unawaited` que personne n'attrape : c'est
      // toute l'application qui tombe pour un cycle qui n'intéresse plus
      // personne.
      if (!ref.mounted) return outcome;
      state = state.copyWith(
        running: false,
        lastRunAt: DateTime.now(),
        lastPushed: outcome.pushed,
        lastError: outcome.status == SyncRunStatus.failed
            ? outcome.reason
            : null,
        lastErrorKind: outcome.status == SyncRunStatus.failed
            ? outcome.kind
            : null,
        clearError: outcome.status != SyncRunStatus.failed,
      );
      if (outcome.kind == FailureKind.sessionExpired) {
        ref.read(authControllerProvider.notifier).onSessionExpired();
      }
      _recordReachability(outcome);
      if (pull && outcome.isOk) await _pullDirectory();
      return outcome;
    } on Object catch (e) {
      if (ref.mounted) {
        state = state.copyWith(
          running: false,
          lastRunAt: DateTime.now(),
          lastError: e.toString(),
          lastErrorKind: FailureKind.retryable,
        );
      }
      return const SyncOutcome.failed(
        'unexpected',
        kind: FailureKind.retryable,
      );
    }
  }

  /// L'annuaire n'avait qu'un seul déclencheur, un bouton d'écran : le
  /// téléconseiller parti sans avoir appuyé composait des numéros
  /// « introuvables » toute la journée. Son échec ne fait pas échouer le cycle,
  /// à la différence d'une page de saisies perdue.
  Future<void> _pullDirectory() async {
    try {
      await ref
          .read(phase2DirectoryProvider)
          .pull(maxPages: directoryPagesPerRun);
    } on Object catch (e, stack) {
      developer.log(
        'Annuaire de phase 2 non rafraîchi',
        name: 'cpi.sync',
        error: e,
        stackTrace: stack,
      );
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
    try {
      final int schedulable = await ref
          .read(syncEngineProvider)
          .schedulableCount();
      if (schedulable <= 0) return;
      await BackgroundSync.enqueueCatchUp();
    } on Object catch (e, stack) {
      // La file reste intacte : le prochain retour au premier plan la videra.
      developer.log(
        'Rattrapage de fond non programmé',
        name: 'cpi.sync',
        error: e,
        stackTrace: stack,
      );
    }
  }
}
