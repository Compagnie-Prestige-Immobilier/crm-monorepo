import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/connectivity.dart';
import '../../core/providers/sync_coordinator.dart';
import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final CpiColors cpi = context.cpi;
    final int needsAttention = ref.watch(needsAttentionCountProvider).value ?? 0;

    return Scaffold(
      body: shell,
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const PendingBanner(),
          NavigationBar(
            selectedIndex: shell.currentIndex,
            onDestinationSelected: (int index) => shell.goBranch(
              index,
              initialLocation: index == shell.currentIndex,
            ),
            destinations: <Widget>[
              const NavigationDestination(
                icon: Icon(PhosphorIconsRegular.house),
                selectedIcon: Icon(PhosphorIconsFill.house),
                label: 'Accueil',
              ),
              const NavigationDestination(
                icon: Icon(PhosphorIconsRegular.clockCounterClockwise),
                selectedIcon: Icon(PhosphorIconsFill.clockCounterClockwise),
                label: 'Historique',
              ),
              NavigationDestination(
                icon: Badge(
                  isLabelVisible: needsAttention > 0,
                  backgroundColor: cpi.syncFailed,
                  label: Text('$needsAttention'),
                  child: const Icon(PhosphorIconsRegular.warningCircle),
                ),
                selectedIcon: Badge(
                  isLabelVisible: needsAttention > 0,
                  backgroundColor: cpi.syncFailed,
                  label: Text('$needsAttention'),
                  child: const Icon(PhosphorIconsFill.warningCircle),
                ),
                label: 'À corriger',
              ),
              const NavigationDestination(
                icon: Icon(PhosphorIconsRegular.gear),
                selectedIcon: Icon(PhosphorIconsFill.gear),
                label: 'Réglages',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class PendingBanner extends ConsumerStatefulWidget {
  const PendingBanner({super.key});

  static const Duration successLinger = Duration(seconds: 4);

  @override
  ConsumerState<PendingBanner> createState() => _PendingBannerState();
}

class _PendingBannerState extends ConsumerState<PendingBanner> {
  Timer? _successTimer;
  bool _showSuccess = false;

  @override
  void dispose() {
    _successTimer?.cancel();
    super.dispose();
  }

  void _onPendingChanged(int before, int after) {
    if (before <= 0 || after != 0) return;
    _successTimer?.cancel();
    setState(() => _showSuccess = true);
    _successTimer = Timer(PendingBanner.successLinger, () {
      if (mounted) setState(() => _showSuccess = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<int>>(pendingSyncCountProvider, (
      AsyncValue<int>? previous,
      AsyncValue<int> next,
    ) {
      _onPendingChanged(previous?.value ?? 0, next.value ?? 0);
    });

    final int pending = ref.watch(pendingSyncCountProvider).value ?? 0;
    final SyncUiState sync = ref.watch(syncCoordinatorProvider);
    final bool running = sync.running;
    final CpiConnectivity network = ref.watch(connectivityProvider);
    final bool offline = network != CpiConnectivity.online;

    final CpiColors cpi = context.cpi;

    final ({IconData icon, String label, Color color, Color surface, Color border})? tone;
    if (pending > 0) {
      final String count = '$pending élément${pending > 1 ? 's' : ''}';
      tone = switch ((offline, running)) {
        (true, _) => (
          icon: network == CpiConnectivity.unreachable
              ? PhosphorIconsRegular.plugsConnected
              : PhosphorIconsRegular.cloudSlash,
          label: network == CpiConnectivity.unreachable
              ? 'Serveur injoignable : $count attend. '
                    'Vérifiez le portail Wi-Fi ou votre crédit data'
              : 'Hors ligne : $count sera envoyé au retour du réseau',
          color: cpi.accentText,
          surface: cpi.accentSurface,
          border: cpi.accentBorder,
        ),
        (false, true) => (
          icon: PhosphorIconsRegular.arrowsClockwise,
          label: 'Envoi en cours : $count',
          color: cpi.info,
          surface: cpi.infoSurface,
          border: cpi.info,
        ),
        (false, false) when sync.failureLabel != null => (
          icon: PhosphorIconsRegular.warningCircle,
          label: '$count en attente : ${sync.failureLabel}',
          color: cpi.syncFailed,
          surface: cpi.accentSurface,
          border: cpi.syncFailed,
        ),
        (false, false) => (
          icon: PhosphorIconsRegular.cloudArrowUp,
          label: '$count en attente d\'envoi',
          color: cpi.accentText,
          surface: cpi.accentSurface,
          border: cpi.accentBorder,
        ),
      };
    } else if (_showSuccess) {
      tone = (
        icon: PhosphorIconsRegular.checkCircle,
        label: 'Tout est envoyé',
        color: cpi.success,
        surface: cpi.successSurface,
        border: cpi.success,
      );
    } else {
      tone = null;
    }

    final CpiMotion motion = CpiMotion.of(context);
    return AnimatedSize(
      duration: motion.component,
      curve: motion.easeOut,
      alignment: Alignment.bottomCenter,
      child: AnimatedSwitcher(
        duration: motion.micro,
        child: tone == null
            ? const SizedBox(width: double.infinity)
            : _BannerBody(
                key: ValueKey<String>(tone.label),
                icon: tone.icon,
                label: tone.label,
                color: tone.color,
                surface: tone.surface,
                border: tone.border,
              ),
      ),
    );
  }
}

class _BannerBody extends StatelessWidget {
  const _BannerBody({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    required this.surface,
    required this.border,
  });

  final IconData icon;
  final String label;
  final Color color;
  final Color surface;
  final Color border;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.xxs,
        CpiSpacing.md,
        CpiSpacing.xxs,
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: CpiSpacing.sm,
        vertical: CpiSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: CpiRadius.brMd,
        border: Border.all(color: border.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: <Widget>[
          Icon(icon, size: 18, color: color),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(color: color),
            ),
          ),
        ],
      ),
    );
  }
}
