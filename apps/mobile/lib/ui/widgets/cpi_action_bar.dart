import 'package:flutter/material.dart';
import 'package:forui/forui.dart';

import '../../core/theme/cpi_tokens.dart';
import 'cpi_forui.dart';

/// La barre d'action épinglée en bas d'un écran de liste ou de formulaire.
///
/// Cinq écrans la recopiaient à l'identique, avec un pas de padding devenu
/// incohérent d'une copie à l'autre : la géométrie qui débordait de 145 px à
/// 320 dp n'avait aucun endroit unique où être corrigée.
class CpiActionBar extends StatelessWidget {
  const CpiActionBar({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) => ColoredBox(
      color: Theme.of(context).colorScheme.surface,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const FDivider(
            style: FDividerStyleDelta.delta(
              padding: EdgeInsetsGeometryDelta.value(EdgeInsets.zero),
            ),
          ),
          Padding(
            // Posée en pied de `FScaffold`, la barre est le dernier widget de
            // l'écran : c'est à elle d'écarter la barre de gestes. Sous un
            // `SafeArea` qui l'a déjà fait, `paddingOf` vaut zéro.
            padding: EdgeInsets.fromLTRB(
              CpiSpacing.md,
              CpiSpacing.xs,
              CpiSpacing.md,
              CpiSpacing.sm + MediaQuery.paddingOf(context).bottom,
            ),
            child: child,
          ),
        ],
      ),
    ),
  );
}
