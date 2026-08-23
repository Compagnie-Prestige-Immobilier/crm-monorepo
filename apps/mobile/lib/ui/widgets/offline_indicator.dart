import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/connectivity.dart';
import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

class OfflineIndicator extends ConsumerWidget {
  const OfflineIndicator({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final CpiConnectivity state = ref.watch(connectivityProvider);

    return AnimatedSwitcher(
      duration: CpiMotion.of(context).micro,
      switchInCurve: CpiMotion.of(context).easeSpring,
      transitionBuilder: (Widget child, Animation<double> animation) =>
          ScaleTransition(scale: animation, child: child),
      child: switch (state) {
        CpiConnectivity.offline => const _OfflinePulse(
          key: ValueKey<String>('offline'),
          icon: PhosphorIconsRegular.wifiSlash,
          label: 'Hors ligne. Les saisies partiront au retour du réseau.',
        ),
        CpiConnectivity.unreachable => const _OfflinePulse(
          key: ValueKey<String>('unreachable'),
          icon: PhosphorIconsRegular.plugsConnected,
          label:
              'Réseau présent mais serveur injoignable. '
              'Vérifiez le portail Wi-Fi ou votre crédit data.',
        ),
        CpiConnectivity.online => const SizedBox.shrink(),
      },
    );
  }
}

class _OfflinePulse extends StatefulWidget {
  const _OfflinePulse({super.key, required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  State<_OfflinePulse> createState() => _OfflinePulseState();
}

class _OfflinePulseState extends State<_OfflinePulse>
    with SingleTickerProviderStateMixin {
  /// WCAG 2.2.2 : un mouvement qui démarre seul doit s'arrêter avant cinq
  /// secondes. Le réseau, lui, peut manquer toute la journée.
  static const Duration _fenetre = Duration(seconds: 5);

  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );
  Timer? _plafond;
  bool _termine = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final bool reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (reduced || _termine) {
      _immobilise();
    } else if (!_controller.isAnimating) {
      unawaited(_controller.repeat(reverse: true));
      _plafond ??= Timer(_fenetre, () {
        _termine = true;
        if (mounted) _immobilise();
      });
    }
  }

  void _immobilise() {
    if (_controller.isAnimating) _controller.stop();
    _controller.value = 0;
  }

  @override
  void dispose() {
    _plafond?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final Color color = context.cpi.accentOnDark;
    final Widget icon = Icon(widget.icon, size: CpiIconSize.md, color: color);

    return Semantics(
      label: widget.label,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: CpiSpacing.xs),
        child: FadeTransition(
          opacity: Tween<double>(begin: 1, end: 0.45).animate(_controller),
          child: icon,
        ),
      ),
    );
  }
}
