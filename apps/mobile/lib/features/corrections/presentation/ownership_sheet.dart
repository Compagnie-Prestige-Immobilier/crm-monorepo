import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/sync/api_port.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/local/database.dart';

/// Feuille d'arbitrage : « ce numéro appartient à quelqu'un d'autre ».
///
/// **Pourquoi on demande, au lieu de fusionner.**
///
/// Quand le représentant en doublon est le mien, le moteur fusionne tout seul,
/// sans rien afficher : l'utilisateur n'a aucune décision à prendre, et lui poser
/// la question serait lui demander d'arbitrer un problème qu'il ne peut pas
/// comprendre.
///
/// Quand il appartient à un **autre commercial**, il n'existe pas de bonne
/// réponse automatique. L'attribution d'un représentant détermine la commission :
/// rattacher en silence les prospects de l'un au portefeuille de l'autre produit
/// une paie fausse à la fin du mois, et personne ne remontera six semaines plus
/// tard jusqu'à une fusion automatique. On nomme donc explicitement le
/// propriétaire et son département, et on laisse trois issues :
///
/// * **Rattacher mes prospects** — c'est bien la même personne, mes prospects
///   rejoignent sa fiche ; ma création de représentant est abandonnée ;
/// * **Corriger le numéro** — c'est une faute de frappe, j'ouvre la fiche ;
/// * **Supprimer** — j'abandonne cette saisie et ce qui en dépend.
Future<void> showOwnershipSheet({
  required BuildContext context,
  required OutboxData row,
  required RepresentantLookup lookup,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (BuildContext context) => _OwnershipSheet(row: row, lookup: lookup),
  );
}

class _OwnershipSheet extends ConsumerWidget {
  const _OwnershipSheet({required this.row, required this.lookup});

  final OutboxData row;
  final RepresentantLookup lookup;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final String owner = lookup.ownedByCommercialName ?? 'un autre commercial';
    final String? departement = lookup.representant?.departementName;
    final String where = departement == null ? '' : ' ($departement)';

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          CpiSpacing.md,
          0,
          CpiSpacing.md,
          CpiSpacing.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Icon(PhosphorIconsRegular.userCircle, size: 22, color: cpi.accentText),
                const SizedBox(width: CpiSpacing.xs),
                Expanded(
                  child: Text(
                    'Numéro déjà enregistré',
                    style: theme.textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: CpiSpacing.xs),
            Text(
              'Ce numéro est déjà enregistré par $owner$where.',
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: CpiSpacing.xxs),
            Text(
              'Nous ne rattachons rien automatiquement : c\'est vous qui décidez '
              'à qui reviennent ces prospects.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: CpiSpacing.lg),
            FilledButton.icon(
              onPressed: () => _attach(context, ref),
              icon: const Icon(PhosphorIconsRegular.linkSimple, size: 20),
              label: const Text('Rattacher mes prospects'),
            ),
            const SizedBox(height: CpiSpacing.xs),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.of(context).pop();
                context.push(
                  '${Routes.newRepresentant}?id=${Uri.encodeComponent(row.entityId)}',
                );
              },
              icon: const Icon(PhosphorIconsRegular.pencilSimple, size: 20),
              label: const Text('Corriger le numéro'),
            ),
            const SizedBox(height: CpiSpacing.xs),
            TextButton.icon(
              onPressed: () async {
                await ref.read(writeRepositoryProvider).discardOperation(row.seq);
                if (context.mounted) Navigator.of(context).pop();
              },
              icon: Icon(PhosphorIconsRegular.trash, size: 20, color: cpi.syncFailed),
              label: Text(
                'Supprimer cette saisie',
                style: TextStyle(color: cpi.syncFailed),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Rattache mes prospects à la fiche existante.
  ///
  /// Le remappage est celui du moteur, pas une variante locale : une seconde
  /// implémentation du même remappage divergerait au premier correctif appliqué
  /// à une seule des deux.
  Future<void> _attach(BuildContext context, WidgetRef ref) async {
    final String? serverId = lookup.representant?.id;
    if (serverId == null) return;
    await ref.read(syncEngineProvider).remapEntityId(row.entityId, serverId);
    // La création du représentant n'a plus lieu d'être : la fiche existe déjà
    // côté serveur. On l'abandonne SANS cascade — les prospects, eux, viennent
    // d'être repointés et doivent partir.
    await ref.read(writeRepositoryProvider).discardOwnCreateOnly(row.id);
    await ref.read(syncCoordinatorProvider.notifier).run(pull: false);
    if (context.mounted) Navigator.of(context).pop();
  }
}
