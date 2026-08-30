import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../ui/widgets/cpi_kit.dart';

/// Bandeau tant qu'un rappel promis est passé sans avoir été honoré.
///
/// Un rappel est honoré quand un appel de plus est consigné sur la fiche :
/// la ligne quitte alors la liste et le bandeau disparaît de lui-même.
class RappelsEnRetardBanner extends ConsumerStatefulWidget {
  const RappelsEnRetardBanner({
    super.key,
    this.grandPublic = false,
    this.padded = true,
    this.lien = true,
  });

  final bool grandPublic;

  /// Vrai dans `CpiScaffold.banner`, qui attend un bandeau à marges complètes.
  /// Faux dans un corps déjà en gouttière, où seule la marge du bas manque.
  final bool padded;

  /// Faux sur la liste des rappels elle-même : le lien y renverrait sur place.
  final bool lien;

  @override
  ConsumerState<RappelsEnRetardBanner> createState() =>
      _RappelsEnRetardBannerState();
}

class _RappelsEnRetardBannerState extends ConsumerState<RappelsEnRetardBanner> {
  Timer? _minute;

  /// Le retard vient du temps qui passe, pas d'une écriture en base : sans ce
  /// battement, un écran resté ouvert ne verrait jamais l'heure tomber.
  @override
  void initState() {
    super.initState();
    _minute = Timer.periodic(
      const Duration(minutes: 1),
      (_) => setState(() {}),
    );
  }

  @override
  void dispose() {
    _minute?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final List<Rappel> rappels =
        ref
            .watch(
              widget.grandPublic
                  ? grandPublicRappelsProvider
                  : representantRappelsProvider,
            )
            .value ??
        const <Rappel>[];
    final DateTime maintenant = ref.watch(clockProvider).now();
    final List<Rappel> retard = rappels
        .where((Rappel r) => r.at.isBefore(maintenant))
        .toList(growable: false);
    if (retard.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: widget.padded
          ? EdgeInsets.zero
          : const EdgeInsets.only(bottom: CpiSpacing.sm),
      child: CpiStatusBand(
        text: retard.length == 1
            ? 'Rappel en retard : ${retard.single.nom}.'
            : '${retard.length} rappels en retard.',
        tone: CpiTone.danger,
        actionLabel: widget.lien ? 'Voir les rappels' : null,
        onAction: widget.lien
            ? () => context.pushOnce(
                widget.grandPublic ? Routes.grandPublicRappels : Routes.rappels,
              )
            : null,
        padded: widget.padded,
      ),
    );
  }
}
