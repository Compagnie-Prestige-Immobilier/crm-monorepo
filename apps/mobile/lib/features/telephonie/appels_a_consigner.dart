import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/sync_coordinator.dart';
import '../../core/telephonie/appels_crm.dart';

class AppelsDetectesListener extends ConsumerStatefulWidget {
  const AppelsDetectesListener({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AppelsDetectesListener> createState() =>
      _AppelsDetectesListenerState();
}

class _AppelsDetectesListenerState
    extends ConsumerState<AppelsDetectesListener> {
  AppLifecycleListener? _cycle;
  DateTime? _dernierCycleSynchro;

  @override
  void initState() {
    super.initState();
    _cycle = AppLifecycleListener(onResume: () => unawaited(_balayer()));
    unawaited(Future<void>.microtask(_balayer));
  }

  @override
  void dispose() {
    _cycle?.dispose();
    super.dispose();
  }

  /// Le rapprochement d'abord : un appel lancé depuis une fiche doit trouver
  /// SON entrée de journal avant que le balayage ne la prenne pour un appel
  /// passé hors de l'application.
  Future<void> _balayer() async {
    if (!mounted) return;
    if (!ref.read(authControllerProvider).isAuthenticated) return;
    final AppelsCrm appels = ref.read(appelsCrmProvider.notifier);
    await appels.rapprocherEnAttente();
    await appels.balayerJournal();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(appelsCrmProvider.notifier);
    ref.listen<SyncUiState>(syncCoordinatorProvider, (
      SyncUiState? _,
      SyncUiState next,
    ) {
      final DateTime? fini = next.lastRunAt;
      if (fini == null || fini == _dernierCycleSynchro) return;
      if (next.lastError != null) return;
      _dernierCycleSynchro = fini;
      unawaited(_balayer());
    });
    return widget.child;
  }
}
