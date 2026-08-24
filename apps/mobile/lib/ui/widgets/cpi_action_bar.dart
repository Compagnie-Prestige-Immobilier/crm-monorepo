import 'package:flutter/material.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

/// La barre d'action épinglée en bas d'un écran de liste ou de formulaire.
///
/// Cinq écrans la recopiaient à l'identique, avec un pas de padding devenu
/// incohérent d'une copie à l'autre : la géométrie qui débordait de 145 px à
/// 320 dp n'avait aucun endroit unique où être corrigée.
class CpiActionBar extends StatelessWidget {
  const CpiActionBar({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.xs,
        CpiSpacing.md,
        CpiSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(top: BorderSide(color: context.cpi.borderSubtle)),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[child]),
    );
  }
}
