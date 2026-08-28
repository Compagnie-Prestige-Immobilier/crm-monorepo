import 'dart:async';

import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';
import 'cpi_forui.dart';
import 'cpi_kit.dart';

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

  /// Une seule grammaire d'état, en mots simples, partout dans l'app.
  String get label => switch (this) {
    SyncStatus.draft || SyncStatus.pending => 'Pas encore envoyé',
    SyncStatus.syncing => 'Envoi…',
    SyncStatus.synced => 'Envoyé ✓',
    SyncStatus.conflict ||
    SyncStatus.failed ||
    SyncStatus.blocked => 'À corriger',
  };

  bool get needsAttention => switch (this) {
    SyncStatus.conflict || SyncStatus.failed || SyncStatus.blocked => true,
    _ => false,
  };

  /// Le ton du kit qui va avec l'état. Source unique : quatre écrans le
  /// retraduisaient à la main, et « À corriger » sortait tantôt en rouge,
  /// tantôt en neutre.
  CpiTone get tone => switch (this) {
    SyncStatus.draft || SyncStatus.pending => CpiTone.neutral,
    SyncStatus.syncing => CpiTone.neutral,
    SyncStatus.synced => CpiTone.success,
    SyncStatus.conflict => CpiTone.warning,
    SyncStatus.failed || SyncStatus.blocked => CpiTone.danger,
  };

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

class SyncStatusIcon extends StatefulWidget {
  const SyncStatusIcon({
    super.key,
    required this.status,
    this.size = CpiIconSize.sm,
    this.labelled = true,
  });

  final SyncStatus status;
  final double size;

  /// Faux quand l'appelant porte déjà l'étiquette (info-bulle, texte visible) :
  /// nue, l'icône n'apprend rien au commercial qui voit un nuage barré.
  final bool labelled;

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
    final bool shouldSpin =
        widget.status == SyncStatus.syncing &&
        !(MediaQuery.maybeDisableAnimationsOf(context) ?? false);
    if (shouldSpin && !_controller.isAnimating) {
      unawaited(_controller.repeat());
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

    final Widget switched = AnimatedSwitcher(
      duration: motion.micro,
      switchInCurve: motion.easeSpring,
      switchOutCurve: motion.easeOut,
      transitionBuilder: (Widget child, Animation<double> animation) =>
          ScaleTransition(scale: animation, child: child),
      child: icon,
    );

    final Widget rendu = widget.status == SyncStatus.syncing
        ? RotationTransition(turns: _controller, child: switched)
        : switched;
    if (!widget.labelled) return rendu;
    return Semantics(
      label: 'État de synchronisation : ${widget.status.label}',
      child: rendu,
    );
  }
}

class SyncStatusChip extends StatelessWidget {
  const SyncStatusChip({super.key, required this.status});

  final SyncStatus status;

  @override
  Widget build(BuildContext context) {
    final Color color = context.cpi.colorForSyncStatus(status.name);
    return Semantics(
      label: 'État de synchronisation : ${status.label}',
      child: CpiForui(
        // Contour plutôt qu'aplat teinté : la couleur d'état porte le texte,
        // et la poser aussi en fond la ferait passer sous 4,5:1.
        builder: (BuildContext context) => FBadge.raw(
          variant: FBadgeVariant.outline,
          builder: (BuildContext context, FBadgeStyle style) => Padding(
            padding: style.contentStyle.padding,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                SyncStatusIcon(
                  status: status,
                  size: CpiIconSize.xs,
                  labelled: false,
                ),
                const SizedBox(width: CpiSpacing.xxsPlus),
                // « Bloqué par le représentant » débordait : le Row en `min` ne
                // contraint pas son texte, il faut le rendre compressible.
                Flexible(
                  child: Text(
                    status.label,
                    overflow: TextOverflow.ellipsis,
                    style: style.contentStyle.labelTextStyle.copyWith(
                      color: color,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
