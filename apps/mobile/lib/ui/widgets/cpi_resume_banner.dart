import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/cpi_tokens.dart';
import 'cpi_forui.dart';
import 'cpi_kit.dart';

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
    final String who = (label == null || label!.isEmpty) ? 'la saisie' : label!;
    return CpiForui(
      builder: (BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: CpiSpacing.md,
          vertical: CpiSpacing.xs,
        ),
        child: FAlert(
          style: const FAlertStyleDelta.delta(
            padding: EdgeInsetsGeometryDelta.value(
              EdgeInsets.all(CpiSpacing.sm),
            ),
          ),
          icon: const Icon(PhosphorIconsRegular.arrowCounterClockwise),
          // Corps de texte et non titre : le bandeau coiffe un formulaire, il
          // ne doit pas lui prendre sa place à 1,76x.
          title: Text(
            'Saisie non terminée : $who',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          // Les deux issues vivent dans le bandeau : reprendre est le geste
          // attendu, supprimer reste offert mais en retrait. Le `Wrap` les
          // empile plutôt que de rogner un libellé à 1,76x.
          subtitle: Wrap(
            spacing: CpiSpacing.xs,
            runSpacing: CpiSpacing.xxs,
            children: <Widget>[
              CpiButton('Reprendre', onPressed: onResume, expand: false),
              CpiButton(
                'Supprimer',
                variant: CpiButtonVariant.ghost,
                onPressed: onDiscard,
                expand: false,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
