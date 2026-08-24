import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

/// Le bandeau de reprise d'un brouillon, deux copies quasi identiques avant
/// cette extraction.
class CpiResumeBanner extends StatelessWidget {
  const CpiResumeBanner({
    super.key,
    required this.onResume,
    required this.onDiscard,
    this.label,
  });

  final String? label;
  final VoidCallback onResume;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final String who = (label == null || label!.isEmpty) ? 'la saisie' : label!;
    return Container(
      width: double.infinity,
      color: cpi.infoSurface,
      padding: const EdgeInsets.symmetric(
        horizontal: CpiSpacing.md,
        vertical: CpiSpacing.xs,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(
                PhosphorIconsRegular.arrowCounterClockwise,
                size: CpiIconSize.sm,
                color: cpi.info,
              ),
              const SizedBox(width: CpiSpacing.xs),
              Expanded(
                child: Text(
                  'Saisie non terminée : $who',
                  style: theme.textTheme.bodySmall?.copyWith(color: cpi.info),
                ),
              ),
            ],
          ),
          Wrap(
            alignment: WrapAlignment.end,
            children: <Widget>[
              TextButton(onPressed: onResume, child: const Text('Reprendre')),
              TextButton(onPressed: onDiscard, child: const Text('Supprimer')),
            ],
          ),
        ],
      ),
    );
  }
}
