import 'dart:async';

import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/feedback/feedback.dart';
import '../../core/notifications/rep_callback_notifications.dart';
import '../../core/providers/app_providers.dart';
import '../../core/router/app_router.dart';
import '../../core/router/route_paths.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../core/utils/phone.dart';
import '../../data/local/database.dart';
import '../../data/repositories/write_repository.dart';
import '../../ui/widgets/cpi_kit.dart';
import 'notifications_controller.dart';

/// Fait tomber le rappel promis pendant un appel (issue CALLBACK) sous les yeux
/// du commercial pendant que l'app est ouverte, et traite les gestes faits sur
/// l'alarme système quand elle ne l'est pas.
///
/// La fenêtre s'ouvre dès le PRÉ-RAPPEL, cinq minutes avant l'heure convenue :
/// c'est le temps qu'il faut pour finir ce qu'on est en train de faire.
class RepCallbackDueListener extends ConsumerStatefulWidget {
  const RepCallbackDueListener({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<RepCallbackDueListener> createState() =>
      _RepCallbackDueListenerState();
}

class _RepCallbackDueListenerState
    extends ConsumerState<RepCallbackDueListener> {
  static const Duration _pollInterval = Duration(seconds: 20);

  Timer? _ticker;
  bool _dialogShowing = false;
  bool _notificationsReady = false;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(_pollInterval, (_) => unawaited(_checkDue()));
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _ensureNotificationsInitialized() {
    if (_notificationsReady) return;
    _notificationsReady = true;
    unawaited(_armerLesAlarmes());
    unawaited(ref.read(feedbackProvider).preparer());
  }

  /// Un redémarrage vide la file d'alarmes d'Android, et le récepteur du
  /// greffon ne rejoue que ce qu'il a lui-même posé. Les rappels encore dus se
  /// réarment donc à chaque démarrage authentifié.
  Future<void> _armerLesAlarmes() async {
    final RepCallbackNotifications alarmes = ref.read(
      repCallbackNotificationsProvider,
    );
    await alarmes.initialize(onAction: _surAlarme);
    await alarmes.reprogrammerTout(
      await ref.read(appDatabaseProvider).pendingRepCallbackReminders().get(),
    );
  }

  void _surAlarme(RepCallbackTap tap) {
    if (tap.action == RepCallbackAction.reporter) {
      unawaited(_reporter(<String>[tap.rappelId]));
      return;
    }
    _openRepresentant(tap.representantId);
  }

  void _openRepresentant(String representantId) {
    ref
        .read(pendingPushRouteProvider.notifier)
        .offerRoute(Routes.representantDetailFor(representantId));
  }

  /// Repousse et reprogramme. La reprogrammation reprend les identifiants
  /// système du rappel : rien à annuler côté alarme déjà posée.
  Future<void> _reporter(List<String> ids) async {
    final WriteRepository writes = ref.read(writeRepositoryProvider);
    final RepCallbackNotifications alarmes = ref.read(
      repCallbackNotificationsProvider,
    );
    for (final String id in ids) {
      final RepCallbackReminder? repousse = await writes.snoozeRepCallback(
        id: id,
        by: kRepCallbackReport,
      );
      if (repousse == null) continue;
      await alarmes.schedule(
        id: repousse.id,
        representantId: repousse.representantId,
        fullName: repousse.fullName,
        phoneE164: repousse.phoneE164,
        at: repousse.scheduledAt,
      );
    }
  }

  Future<void> _checkDue() async {
    if (_dialogShowing || !mounted) return;
    if (!ref.read(authControllerProvider).isAuthenticated) return;
    // Clavier ouvert : une saisie est en cours. Le rappel attend le sondage
    // suivant plutôt que de la couper — et il n'est marqué « notifié » qu'au
    // moment où il est réellement montré.
    if (MediaQuery.viewInsetsOf(context).bottom > 0) return;

    final AppDatabase db = ref.read(appDatabaseProvider);
    final DateTime now = ref.read(clockProvider).now();
    final DateTime seuil = now.add(kRepCallbackPreAlerte);
    final List<RepCallbackReminder> dus =
        (await db.pendingRepCallbackReminders().get())
            .where((RepCallbackReminder r) => !r.scheduledAt.isAfter(seuil))
            .toList(growable: false);
    if (dus.isEmpty) return;

    await (db.update(db.repCallbackReminders)..where(
          (RepCallbackReminders row) =>
              row.id.isIn(dus.map((RepCallbackReminder r) => r.id)),
        ))
        .write(
          RepCallbackRemindersCompanion(notifiedAt: Value<DateTime?>(now)),
        );
    if (!mounted) return;

    _dialogShowing = true;
    // La feuille tombe sur n'importe quel écran : sans cette reprise, le focus
    // repart en haut de l'arbre et le lecteur d'écran fait tout relire.
    final FocusNode? focusAvant = FocusManager.instance.primaryFocus;
    // `SystemSound.play(alert)` était MUET : Android n'implémente que `click`.
    ref.read(feedbackProvider).rappel();
    // Le navigateur des routes, pas le contexte de ce listener : il coiffe le
    // `Router` et n'a AUCUN `Navigator` au-dessus de lui. `showCpiSheet` y
    // levait « requested with a context that does not include a Navigator »,
    // dans un `Timer`, donc en silence : la feuille n'est jamais tombée sur
    // appareil. Repli sur le contexte local pour les bancs de test, qui
    // montent le listener sous un `MaterialApp`.
    await showCpiSheet<void>(
      rootNavigatorKey.currentContext ?? context,
      title: dus.length == 1 ? 'Rappel' : '${dus.length} rappels',
      builder: (BuildContext sheet) => _FeuilleRappels(
        rappels: dus,
        maintenant: now,
        onOuvrir: (String representantId) {
          Navigator.of(sheet).pop();
          _openRepresentant(representantId);
        },
        onReporter: () {
          Navigator.of(sheet).pop();
          unawaited(
            _reporter(
              dus.map((RepCallbackReminder r) => r.id).toList(growable: false),
            ),
          );
        },
      ),
    );
    _dialogShowing = false;
    if (focusAvant != null && focusAvant.context != null) {
      focusAvant.requestFocus();
    }
    unawaited(_checkDue());
  }

  @override
  Widget build(BuildContext context) {
    if (ref.watch(authControllerProvider).isAuthenticated) {
      _ensureNotificationsInitialized();
    }
    return widget.child;
  }
}

/// Qui rappeler, dans combien de temps, et les deux seuls gestes possibles.
///
/// Le compte à rebours se recompte chaque seconde : la feuille peut rester
/// ouverte de part et d'autre de l'heure convenue.
class _FeuilleRappels extends StatefulWidget {
  const _FeuilleRappels({
    required this.rappels,
    required this.maintenant,
    required this.onOuvrir,
    required this.onReporter,
  });

  final List<RepCallbackReminder> rappels;
  final DateTime maintenant;
  final ValueChanged<String> onOuvrir;
  final VoidCallback onReporter;

  @override
  State<_FeuilleRappels> createState() => _FeuilleRappelsState();
}

class _FeuilleRappelsState extends State<_FeuilleRappels> {
  late DateTime _maintenant = widget.maintenant;
  Timer? _seconde;

  @override
  void initState() {
    super.initState();
    _seconde = Timer.periodic(
      const Duration(seconds: 1),
      (_) => setState(
        () => _maintenant = _maintenant.add(const Duration(seconds: 1)),
      ),
    );
  }

  @override
  void dispose() {
    _seconde?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bool seul = widget.rappels.length == 1;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        CpiCard.rows(<CpiRow>[
          for (final RepCallbackReminder r in widget.rappels)
            CpiRow(
              leading: const Icon(
                PhosphorIconsRegular.bellRinging,
                size: CpiIconSize.lg,
              ),
              title: r.fullName,
              subtitle:
                  '${Phone.format(r.phoneE164)} · '
                  '${compteARebours(r.scheduledAt, _maintenant)}',
              onTap: () => widget.onOuvrir(r.representantId),
            ),
        ]),
        const SizedBox(height: CpiSpacing.lg),
        if (seul)
          CpiButton(
            'Appeler maintenant',
            icon: PhosphorIconsRegular.phoneCall,
            onPressed: () =>
                widget.onOuvrir(widget.rappels.single.representantId),
          ),
        if (seul) const SizedBox(height: CpiSpacing.xs),
        CpiButton(
          'Plus tard (10 min)',
          variant: CpiButtonVariant.ghost,
          onPressed: widget.onReporter,
        ),
      ],
    );
  }
}

/// « dans 4 min », « maintenant », « en retard de 12 min ». Sous la minute, on
/// compte les secondes : c'est ce qui rend l'attente supportable.
String compteARebours(DateTime at, DateTime maintenant) {
  final Duration reste = at.difference(maintenant);
  if (reste.inSeconds > 60) return 'dans ${(reste.inSeconds / 60).ceil()} min';
  if (reste.inSeconds > 0) return 'dans ${reste.inSeconds} s';
  final int retard = -reste.inMinutes;
  return retard < 1 ? 'maintenant' : 'en retard de $retard min';
}
