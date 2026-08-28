import 'dart:async';

import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/feedback/feedback.dart';
import '../../core/notifications/rep_callback_notifications.dart';
import '../../core/providers/app_providers.dart';
import '../../core/router/route_paths.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../core/utils/phone.dart';
import '../../data/local/database.dart';
import '../../ui/widgets/cpi_kit.dart';
import 'notifications_controller.dart';

/// Fait tomber le rappel promis pendant un appel représentant (issue
/// CALLBACK) sous les yeux du commercial pendant que l'app est ouverte : la
/// notification système (`RepCallbackNotifications`) couvre le cas où elle
/// ne l'est pas, mais ne montre rien de plus qu'un tap tant que l'app tourne
/// au premier plan.
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
    unawaited(
      ref
          .read(repCallbackNotificationsProvider)
          .initialize(onTap: _openRepresentant),
    );
    unawaited(ref.read(feedbackProvider).preparer());
  }

  void _openRepresentant(String representantId) {
    ref
        .read(pendingPushRouteProvider.notifier)
        .offerRoute(Routes.representantDetailFor(representantId));
  }

  Future<void> _checkDue() async {
    if (_dialogShowing || !mounted) return;
    if (!ref.read(authControllerProvider).isAuthenticated) return;
    // Clavier ouvert : une saisie est en cours. Le rappel attend le sondage
    // suivant plutôt que de la couper — et il n'est marqué « notifié » qu'au
    // moment où il est réellement montré.
    if (MediaQuery.viewInsetsOf(context).bottom > 0) return;

    final AppDatabase db = ref.read(appDatabaseProvider);
    final List<RepCallbackReminder> pending = await db
        .pendingRepCallbackReminders()
        .get();
    final DateTime now = DateTime.now();
    final RepCallbackReminder? due = pending
        .cast<RepCallbackReminder?>()
        .firstWhere(
          (RepCallbackReminder? r) => !r!.scheduledAt.isAfter(now),
          orElse: () => null,
        );
    if (due == null) return;

    await (db.update(
      db.repCallbackReminders,
    )..where((RepCallbackReminders row) => row.id.equals(due.id))).write(
      RepCallbackRemindersCompanion(notifiedAt: Value<DateTime?>(now)),
    );
    if (!mounted) return;

    _dialogShowing = true;
    // La feuille tombe sur n'importe quel écran : sans cette reprise, le focus
    // repart en haut de l'arbre et le lecteur d'écran fait tout relire.
    final FocusNode? focusAvant = FocusManager.instance.primaryFocus;
    // `SystemSound.play(alert)` était MUET : Android n'implémente que `click`.
    ref.read(feedbackProvider).rappel();
    await showCpiSheet<void>(
      context,
      title: 'Rappel',
      builder: (BuildContext sheet) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            '${due.fullName}\n${Phone.format(due.phoneE164)}',
            style: Theme.of(sheet).textTheme.bodyMedium?.copyWith(
              color: Theme.of(sheet).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: CpiSpacing.lg),
          CpiButton(
            'Ouvrir la fiche',
            onPressed: () {
              Navigator.of(sheet).pop();
              _openRepresentant(due.representantId);
            },
          ),
          const SizedBox(height: CpiSpacing.xs),
          CpiButton(
            'Fermer',
            variant: CpiButtonVariant.ghost,
            onPressed: () => Navigator.of(sheet).pop(),
          ),
        ],
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
