import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../background/background_sync.dart';
import '../sync/api_port.dart';
import '../sync/sync_engine.dart';
import 'app_providers.dart';

/// Ce que l'UI sait de la synchronisation en cours.
@immutable
class SyncUiState {
  const SyncUiState({
    this.running = false,
    this.lastRunAt,
    this.lastError,
    this.lastPushed = 0,
  });

  final bool running;
  final DateTime? lastRunAt;
  final String? lastError;
  final int lastPushed;

  SyncUiState copyWith({
    bool? running,
    DateTime? lastRunAt,
    String? lastError,
    bool clearError = false,
    int? lastPushed,
  }) {
    return SyncUiState(
      running: running ?? this.running,
      lastRunAt: lastRunAt ?? this.lastRunAt,
      lastError: clearError ? null : (lastError ?? this.lastError),
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
          other.lastPushed == lastPushed;

  @override
  int get hashCode => Object.hash(running, lastRunAt, lastError, lastPushed);
}

/// Orchestre les déclencheurs de premier plan.
///
/// **Le premier plan est le chemin PRINCIPAL, l'arrière-plan un complément.**
/// Android 15 plafonne les services `dataSync` à 6 h par 24 h, Android 16 durcit
/// les quotas JobScheduler, et les ROM Transsion (Tecno, Infinix, itel) et
/// Xiaomi — l'essentiel du parc sénégalais — tuent les tâches de fond quoi qu'en
/// dise AOSP. Une app qui compterait sur WorkManager pour envoyer ses données
/// perdrait la moitié de ses saisies chez la moitié de ses utilisateurs.
///
/// Cinq déclencheurs, tous de premier plan :
///
/// 1. changement de connectivité, avec 2 s d'anti-rebond ;
/// 2. retour au premier plan (`AppLifecycleState.resumed`) ;
/// 3. après chaque écriture locale ([nudge]) ;
/// 4. un minuteur de 60 s tant que l'app est visible ;
/// 5. le bouton « Synchroniser maintenant ».
///
/// ## Sur `connectivity_plus`
///
/// Il rapporte **l'état de l'interface, pas l'accessibilité du réseau**. Sur les
/// réseaux mobiles sénégalais, un lien dégradé annonce `mobile` alors que plus
/// rien ne route — c'est le cas le plus fréquent, pas un cas limite. On s'en sert
/// donc comme **déclencheur** et jamais comme condition : le moteur essaie, et
/// c'est l'échec réseau réel qui décide du back-off. Conditionner l'envoi à
/// `!= none` supprimerait des envois qui auraient marché, et en autoriserait
/// d'autres qui ne peuvent pas.
class SyncCoordinator extends Notifier<SyncUiState> {
  static const Duration connectivityDebounce = Duration(seconds: 2);
  static const Duration foregroundPeriod = Duration(seconds: 60);

  Timer? _periodic;
  Timer? _connectivityDebounce;
  StreamSubscription<List<ConnectivityResult>>? _connectivity;
  AppLifecycleListener? _lifecycle;
  bool _observing = false;

  @override
  SyncUiState build() {
    ref.onDispose(_teardown);
    // Le démarrage est différé d'un micro-tâche : `build` doit rendre un état
    // synchrone, et brancher des écouteurs pendant la construction du provider
    // déclencherait une modification d'état en pleine construction.
    Future<void>.microtask(_start);
    return const SyncUiState();
  }

  void _start() {
    if (_observing) return;
    _observing = true;
    _lifecycle = AppLifecycleListener(
      onResume: () => unawaited(run()),
      // Un one-off n'est enfilé QUE s'il reste quelque chose à envoyer :
      // programmer un worker pour une file vide consomme un quota JobScheduler
      // pour rien, et Android 16 les compte.
      onPause: () => unawaited(_scheduleCatchUp()),
    );
    _connectivity = Connectivity().onConnectivityChanged.listen((
      List<ConnectivityResult> _,
    ) {
      // Anti-rebond de 2 s : un basculement Wi-Fi → mobile émet trois ou quatre
      // événements en moins d'une seconde, et chacun déclencherait une vidange.
      _connectivityDebounce?.cancel();
      _connectivityDebounce = Timer(connectivityDebounce, () => run(pull: false));
    });
    _periodic = Timer.periodic(foregroundPeriod, (Timer _) => run());
    unawaited(run());
  }

  void _teardown() {
    _periodic?.cancel();
    _connectivityDebounce?.cancel();
    unawaited(_connectivity?.cancel());
    _lifecycle?.dispose();
    _lifecycle = null;
    _observing = false;
  }

  /// Déclencheur « après une écriture locale ». Sans pull : on vient d'écrire,
  /// tirer maintenant ne rapporterait rien et coûterait un aller-retour.
  void nudge() => unawaited(run(pull: false));

  /// Un cycle. Le vol unique est dans le moteur, pas ici : les deux isolats
  /// doivent le partager.
  Future<SyncOutcome> run({bool pull = true}) async {
    final SyncEngine engine = ref.read(syncEngineProvider);
    if (engine.isDraining) {
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
        clearError: outcome.status != SyncRunStatus.failed,
      );
      if (outcome.kind == FailureKind.sessionExpired) {
        ref.read(authControllerProvider.notifier).onSessionExpired();
      }
      return outcome;
    } on Object catch (e) {
      // Un cycle ne doit jamais faire remonter d'exception : il tourne sur un
      // minuteur, et une exception non rattrapée sur un minuteur tue la zone.
      state = state.copyWith(
        running: false,
        lastRunAt: DateTime.now(),
        lastError: e.toString(),
      );
      return SyncOutcome.failed('unexpected', kind: FailureKind.retryable);
    }
  }

  Future<void> _scheduleCatchUp() async {
    final int pending = await ref.read(syncEngineProvider).pendingCount();
    if (pending <= 0) return;
    await BackgroundSync.enqueueCatchUp();
  }
}
