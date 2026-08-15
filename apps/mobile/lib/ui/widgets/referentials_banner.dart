import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

/// « Les listes sont vides, et voici quoi faire. »
///
/// ═══ L'IMPASSE QU'IL SUPPRIME ═══
///
/// Sur une installation neuve dont la première synchronisation n'a pas abouti,
/// les référentiels (départements, banques, syndicats) sont vides. Les listes
/// déroulantes ne réagissent alors à rien, « Enregistrer » reste grisé pour
/// toujours, et l'écran n'en disait **pas un mot** : le message prévu vivait
/// dans `optionsViewBuilder`, que Flutter ne construit jamais quand la liste
/// est vide.
///
/// Un commercial dans cette situation conclut que l'application est cassée. Il
/// n'a pas tort ; il lui manque seulement la seule action qui répare, et elle
/// est ici.
class ReferentialsBanner extends ConsumerStatefulWidget {
  const ReferentialsBanner({super.key, required this.missing});

  /// Vrai quand au moins un référentiel indispensable à cet écran est vide.
  /// Chaque formulaire sait lesquels le concernent : le sélecteur de
  /// département ne sert pas à la saisie d'un prospect.
  final bool missing;

  @override
  ConsumerState<ReferentialsBanner> createState() => _ReferentialsBannerState();
}

class _ReferentialsBannerState extends ConsumerState<ReferentialsBanner> {
  bool _running = false;

  Future<void> _sync() async {
    setState(() => _running = true);
    try {
      await ref.read(syncCoordinatorProvider.notifier).run();
    } finally {
      if (mounted) setState(() => _running = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.missing) return const SizedBox.shrink();
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;

    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        color: cpi.accentSurface,
        padding: const EdgeInsets.symmetric(
          horizontal: CpiSpacing.md,
          vertical: CpiSpacing.xs,
        ),
        // ═══ LE BOUTON EST SOUS LE TEXTE, PAS À CÔTÉ ═══
        //
        // Il était à côté, dans le même `Row`, et c'est ce qui faisait déborder
        // les deux formulaires de saisie. Un `TextButton` n'est pas flexible :
        // dans un `Row`, il prend sa largeur intrinsèque AVANT que l'`Expanded`
        // ne reçoive le reste. Sur 320 dp, « Synchroniser » réclamait 215 px
        // des 288 disponibles ; il restait 39 px au message, qui se repliait
        // sur quarante lignes et faisait 726 px de haut. Le bandeau, enfant non
        // flexible de la colonne du formulaire, débordait alors l'écran de
        // 145 px : à la taille de texte NORMALE, sur un téléphone d'entrée de
        // gamme ordinaire.
        //
        // Empiler supprime la concurrence : le message dispose de toute la
        // largeur, et sa hauteur ne dépend plus que du nombre de lignes réel.
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(
                  PhosphorIconsRegular.cloudArrowDown,
                  size: 18,
                  color: cpi.accentText,
                ),
                const SizedBox(width: CpiSpacing.xs),
                Expanded(
                  child: Text(
                    'Référentiels non téléchargés : synchronisez pour pouvoir '
                    'enregistrer.',
                    style: theme.textTheme.bodySmall?.copyWith(color: cpi.accentText),
                  ),
                ),
              ],
            ),
            // L'action est DANS le bandeau : renvoyer vers Réglages depuis un
            // formulaire ferait perdre la saisie en cours à celui qui obéit.
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton(
                onPressed: _running ? null : _sync,
                child: _running
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Synchroniser'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
