/// Ce que partagent les formulaires en étapes : le retour arrière et le
/// récapitulatif de la dernière étape.
library;

import 'package:flutter/material.dart';

import '../../core/router/back_navigation.dart';
import '../../core/router/route_paths.dart';
import '../../core/theme/cpi_tokens.dart';
import 'cpi_kit.dart';

/// Le retour système d'un formulaire en étapes.
///
/// Depuis la première étape il quitte l'écran ; ailleurs il remonte d'une
/// étape, sans quoi le geste le plus courant d'Android jetterait tout ce qui a
/// été saisi avant. [onBack] nul à une étape autre que la première ferme le
/// geste : c'est l'état d'un enregistrement en cours.
class CpiStepScope extends StatelessWidget {
  const CpiStepScope({
    super.key,
    required this.first,
    required this.child,
    this.onBack,
    this.onExit,
    this.fallback = Routes.home,
  });

  final bool first;
  final Widget child;
  final VoidCallback? onBack;

  /// Ce que fait le retour depuis la première étape quand il ne suffit pas de
  /// quitter : une confirmation, par exemple.
  final VoidCallback? onExit;

  final String fallback;

  @override
  Widget build(BuildContext context) {
    final VoidCallback? onExit = this.onExit;
    if (first && onExit == null) {
      return CpiPopScope(fallback: fallback, child: child);
    }
    final VoidCallback? action = first ? onExit : onBack;
    return PopScope<Object?>(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? _) {
        if (didPop) return;
        action?.call();
      },
      child: child,
    );
  }
}

/// Une ligne du récapitulatif. Une valeur vide se dit, elle ne disparaît pas :
/// c'est ce qui permet de voir avant d'enregistrer qu'un champ est resté vide.
@immutable
class CpiRecapLine {
  const CpiRecapLine(this.label, this.value);

  final String label;
  final String? value;

  String get _text {
    final String? value = this.value;
    return value == null || value.trim().isEmpty
        ? 'Non renseigné'
        : value.trim();
  }
}

/// Ce qui va être enregistré, relu avant de toucher le bouton.
class CpiRecap extends StatelessWidget {
  const CpiRecap({
    super.key,
    required this.lines,
    this.title = 'À enregistrer',
  });

  final List<CpiRecapLine> lines;
  final String title;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return CpiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Semantics(
            header: true,
            child: Text(title, style: theme.textTheme.titleSmall),
          ),
          const SizedBox(height: CpiSpacing.xs),
          for (final CpiRecapLine line in lines)
            Padding(
              padding: const EdgeInsets.only(bottom: CpiSpacing.xxs),
              child: MergeSemantics(
                child: Semantics(
                  label: '${line.label} : ${line._text}',
                  excludeSemantics: true,
                  // Deux parts souples : à 320 dp et 1,76× le libellé comme la
                  // valeur passent à la ligne au lieu de déborder.
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Expanded(
                        flex: 2,
                        child: Text(
                          line.label,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                      const SizedBox(width: CpiSpacing.sm),
                      Expanded(
                        flex: 3,
                        child: Text(
                          line._text,
                          textAlign: TextAlign.end,
                          style:
                              line.value == null || line.value!.trim().isEmpty
                              ? theme.textTheme.bodyMedium?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant,
                                )
                              : theme.textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
