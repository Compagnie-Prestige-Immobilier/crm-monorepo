import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../background/background_sync.dart';
import '../sync/api_port.dart';
import '../sync/sync_engine.dart';
import 'app_providers.dart';
import 'connectivity.dart';

/// Ce que l'UI sait de la synchronisation en cours.
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

  /// Code du dernier échec de cycle. **Il a un consommateur maintenant** : voir
  /// [failureLabel]. Il était classifié avec soin puis jeté, si bien qu'un lien
  /// mort, un serveur en 500 et un throttling produisaient à l'écran exactement
  /// la même chose : un compteur qui ne descend pas.
  final String? lastError;

  /// Famille de l'échec, quand elle est connue. C'est elle qui porte le CONSEIL :
  /// « vérifiez le portail Wi-Fi » et « réessayez dans un instant » ne
  /// s'adressent pas au même problème.
  final FailureKind? lastErrorKind;

  final int lastPushed;

  /// Une phrase que le commercial peut lire et sur laquelle il peut agir, ou
  /// `null` si le dernier cycle est passé.
  ///
  /// La famille prime sur le code : elle décrit ce qu'il faut FAIRE. Le code ne
  /// sert qu'à distinguer deux refus serveur entre eux, et il est rendu tel quel
  /// en dernier recours plutôt que masqué : un mot inattendu se remarque et
  /// remonte, une phrase vague ne remonte jamais.
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

/// Orchestre les déclencheurs de premier plan.
///
/// **Le premier plan est le chemin PRINCIPAL, l'arrière-plan un complément.**
/// Android 15 plafonne les services `dataSync` à 6 h par 24 h, Android 16 durcit
/// les quotas JobScheduler, et les ROM Transsion (Tecno, Infinix, itel) et
/// Xiaomi : l'essentiel du parc sénégalais : tuent les tâches de fond quoi qu'en
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
/// rien ne route : c'est le cas le plus fréquent, pas un cas limite. On s'en sert
/// donc comme **déclencheur** et jamais comme condition : le moteur essaie, et
/// c'est l'échec réseau réel qui décide du back-off. Conditionner l'envoi à
/// `!= none` supprimerait des envois qui auraient marché, et en autoriserait
/// d'autres qui ne peuvent pas.
class SyncCoordinator extends Notifier<SyncUiState> {
  static const Duration foregroundPeriod = Duration(seconds: 60);

  Timer? _periodic;
  AppLifecycleListener? _lifecycle;
  bool _observing = false;

  @override
  SyncUiState build() {
    ref.onDispose(_teardown);
    // Le déclencheur de connectivité passe par le provider PARTAGÉ et non par un
    // `Connectivity()` privé. Trois abonnements coexistaient (celui-ci, celui du
    // contrôleur de mise à jour, celui du provider d'affichage) : trois
    // `NetworkCallback` Android, trois réveils d'isolat par bascule d'antenne, et
    // trois anti-rebonds indépendants qui ne s'accordaient sur rien.
    ref.listen<AsyncValue<List<ConnectivityResult>>>(connectivityTriggerProvider, (
      AsyncValue<List<ConnectivityResult>>? _,
      AsyncValue<List<ConnectivityResult>> next,
    ) {
      if (next.value == null) return;
      unawaited(run(pull: false));
    });
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
      onResume: () {
        // Le minuteur a été annulé à la mise en veille : il faut le remonter,
        // sinon le cycle périodique ne repart jamais de la session.
        _startPeriodic();
        unawaited(run());
      },
      // Un one-off n'est enfilé QUE s'il reste quelque chose à envoyer :
      // programmer un worker pour une file vide consomme un quota JobScheduler
      // pour rien, et Android 16 les compte.
      //
      // **Et le minuteur de 60 s s'arrête ici.** La documentation de cette
      // classe promettait « tant que l'app est visible » ; le code, lui, ne
      // l'annulait jamais. Une application laissée en arrière-plan tirait donc
      // le serveur toutes les minutes, toute la journée, sur un forfait
      // mobile : et c'est exactement le travail que le worker WorkManager est
      // là pour faire, une fois, quand le système le permet.
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

  /// Vrai tant que le cycle périodique de premier plan tourne. Lu par les tests :
  /// « le minuteur s'arrête en veille » est une promesse de la documentation de
  /// cette classe, et elle n'était pas tenue.
  bool get isPolling => _periodic?.isActive ?? false;

  /// Déclencheur « après une écriture locale ». Sans pull : on vient d'écrire,
  /// tirer maintenant ne rapporterait rien et coûterait un aller-retour.
  void nudge() => unawaited(run(pull: false));

  /// Un cycle. Le vol unique est dans le moteur, pas ici : les deux isolats
  /// doivent le partager.
  Future<SyncOutcome> run({bool pull = true}) async {
    final SyncEngine engine = ref.read(syncEngineProvider);
    // `isBusy` et non `isDraining` : ce dernier retombe à `false` dès la fin du
    // push, donc pendant toute la phase de tirage. Le minuteur de 60 s, le
    // retour au premier plan et le bouton « Synchroniser » pouvaient s'y
    // superposer, lire le même curseur et le faire reculer.
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
      // Un cycle ne doit jamais faire remonter d'exception : il tourne sur un
      // minuteur, et une exception non rattrapée sur un minuteur tue la zone.
      state = state.copyWith(
        running: false,
        lastRunAt: DateTime.now(),
        lastError: e.toString(),
        lastErrorKind: FailureKind.retryable,
      );
      return SyncOutcome.failed('unexpected', kind: FailureKind.retryable);
    }
  }

  /// Publie ce que le cycle vient d'apprendre du LIEN, pas de l'interface.
  ///
  /// C'est la seule preuve d'accessibilité que l'application possède, et elle
  /// est gratuite : elle vient d'une requête qu'on faisait de toute façon.
  /// `connectivity_plus` ne peut pas la produire : il annonce `mobile` sur un
  /// portail captif comme sur une carte SIM sans crédit.
  void _recordReachability(SyncOutcome outcome) {
    final UnreachableEvidence evidence = ref.read(
      unreachableEvidenceProvider.notifier,
    );
    if (outcome.kind == FailureKind.unreachable) {
      evidence.record(DateTime.now());
      return;
    }
    // Tout autre verdict prouve qu'un aller-retour a abouti : y compris un refus
    // du serveur, qui est une réponse.
    if (outcome.status != SyncRunStatus.skipped) evidence.clear();
  }

  /// Enfile un one-off **seulement si un worker pourrait y changer quelque
  /// chose**.
  ///
  /// `pendingCount` compte aussi `conflict` et `failed` : des opérations qui
  /// attendent une action HUMAINE et qu'aucune exécution de fond ne fera
  /// avancer. Une seule saisie définitivement refusée suffisait donc à
  /// programmer un worker à chaque mise en veille, tous les jours, pour un
  /// travail impossible : exactement le quota JobScheduler qu'Android 16 compte
  /// et que le commentaire de [BackgroundSync.enqueueCatchUp] prétend épargner.
  Future<void> _scheduleCatchUp() async {
    final int schedulable = await ref.read(syncEngineProvider).schedulableCount();
    if (schedulable <= 0) return;
    await BackgroundSync.enqueueCatchUp();
  }
}
