import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

/// Les sept états qu'une ligne peut prendre vis-à-vis du serveur.
///
/// `blocked` n'existe pas côté serveur : c'est un état **dérivé** propre au
/// client, celui d'un prospect dont le représentant parent est coincé. Sans lui,
/// l'utilisateur verrait « en attente » sur une ligne qui, en réalité, ne
/// partira jamais tant qu'il n'aura pas résolu le parent.
enum SyncStatus {
  draft,
  pending,
  syncing,
  synced,
  conflict,
  failed,
  blocked;

  static SyncStatus parse(String raw) => switch (raw) {
    'pending' => SyncStatus.pending,
    'syncing' => SyncStatus.syncing,
    'synced' => SyncStatus.synced,
    'conflict' => SyncStatus.conflict,
    'failed' => SyncStatus.failed,
    'blocked' => SyncStatus.blocked,
    _ => SyncStatus.draft,
  };

  String get label => switch (this) {
    SyncStatus.draft => 'Brouillon',
    SyncStatus.pending => 'En attente',
    SyncStatus.syncing => 'Envoi en cours',
    SyncStatus.synced => 'Synchronisé',
    SyncStatus.conflict => 'Conflit à résoudre',
    SyncStatus.failed => 'Échec d\'envoi',
    SyncStatus.blocked => 'Bloqué par le représentant',
  };

  /// Icônes figées par docs/design.md §8. Ce sont les seules icônes de l'app qui
  /// portent du sens métier : elles ne se choisissent pas écran par écran.
  IconData get icon => switch (this) {
    SyncStatus.draft => PhosphorIconsRegular.pencilSimple,
    SyncStatus.pending => PhosphorIconsRegular.cloudSlash,
    SyncStatus.syncing => PhosphorIconsRegular.arrowsClockwise,
    SyncStatus.synced => PhosphorIconsRegular.checkCircle,
    SyncStatus.conflict => PhosphorIconsRegular.warningCircle,
    SyncStatus.failed => PhosphorIconsRegular.xCircle,
    SyncStatus.blocked => PhosphorIconsRegular.prohibit,
  };
}

/// Icône d'état, en rotation continue pour le seul état `syncing`.
class SyncStatusIcon extends StatefulWidget {
  const SyncStatusIcon({super.key, required this.status, this.size = 18});

  final SyncStatus status;
  final double size;

  @override
  State<SyncStatusIcon> createState() => _SyncStatusIconState();
}

class _SyncStatusIconState extends State<SyncStatusIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncAnimation();
  }

  @override
  void didUpdateWidget(SyncStatusIcon oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.status != widget.status) _syncAnimation();
  }

  void _syncAnimation() {
    // Une rotation qui tourne alors que rien ne part n'informe de rien, et elle
    // consomme une frame par vsync sur un appareil déjà lent.
    final bool shouldSpin =
        widget.status == SyncStatus.syncing &&
        !(MediaQuery.maybeDisableAnimationsOf(context) ?? false);
    if (shouldSpin && !_controller.isAnimating) {
      _controller.repeat();
    } else if (!shouldSpin && _controller.isAnimating) {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final CpiMotion motion = CpiMotion.of(context);
    final Color color = context.cpi.colorForSyncStatus(widget.status.name);
    final Widget icon = Icon(
      widget.status.icon,
      key: ValueKey<SyncStatus>(widget.status),
      size: widget.size,
      color: color,
    );

    // Le passage d'un état à l'autre est le moment où cette icône dit quelque
    // chose : « en attente » qui devient « envoyé » est exactement ce que
    // l'utilisateur surveille. Un remplacement sec le rend invisible ; un
    // fondu-échelle court de 150 ms le rend perceptible sans le rendre lent.
    // `ScaleTransition` et non une opacité sur un grand sous-arbre : ici le
    // sous-arbre est une icône, la composition est gratuite.
    final Widget switched = AnimatedSwitcher(
      duration: motion.micro,
      switchInCurve: motion.easeSpring,
      switchOutCurve: motion.easeOut,
      transitionBuilder: (Widget child, Animation<double> animation) =>
          ScaleTransition(scale: animation, child: child),
      child: icon,
    );

    if (widget.status != SyncStatus.syncing) return switched;
    return RotationTransition(turns: _controller, child: switched);
  }
}

/// Puce « icône + libellé » pour les listes et les en-têtes de fiche.
class SyncStatusChip extends StatelessWidget {
  const SyncStatusChip({super.key, required this.status});

  final SyncStatus status;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final Color color = context.cpi.colorForSyncStatus(status.name);
    return Semantics(
      label: 'État de synchronisation : ${status.label}',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          SyncStatusIcon(status: status, size: 16),
          const SizedBox(width: CpiSpacing.xxs + 2),
          Text(status.label, style: theme.textTheme.labelMedium?.copyWith(color: color)),
        ],
      ),
    );
  }
}
