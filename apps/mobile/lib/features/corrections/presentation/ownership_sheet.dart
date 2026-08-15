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
import '../../../data/repositories/write_repository.dart';

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
/// * **Rattacher mes prospects** : c'est bien la même personne, mes prospects
///   rejoignent sa fiche ; ma création de représentant est abandonnée ;
/// * **Corriger le numéro** : c'est une faute de frappe, j'ouvre la fiche ;
/// * **Supprimer** : j'abandonne cette saisie et ce qui en dépend.
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
                final DiscardResult result = await ref
                    .read(writeRepositoryProvider)
                    .discardOperation(row.seq);
                if (!context.mounted) return;
                // On ne referme pas la feuille sur un refus : la saisie est
                // toujours là, et la fermer laisserait croire qu'elle est
                // partie.
                if (result.outcome == DiscardOutcome.claimed) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Envoi en cours : réessayez dans quelques instants.',
                      ),
                    ),
                  );
                  return;
                }
                Navigator.of(context).pop();
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
  ///
  /// ═══ CE QU'ON FAIT QUAND LA CRÉATION EST EN VOL ═══
  ///
  /// [WriteRepository.discardOwnCreateOnly] refuse d'effacer une création
  /// réservée par un envoi. Ce refus doit arriver quelque part, sinon on
  /// enchaînait sur la vidange et sur la fermeture de la feuille en affirmant à
  /// l'utilisateur que le rattachement était fait, alors que la création est
  /// toujours là et qu'elle repartira.
  ///
  /// **On s'arrête, on le dit, et on laisse la feuille ouverte.** C'est
  /// exactement ce que fait déjà « Supprimer cette saisie » quelques lignes plus
  /// haut, et pour la même raison : fermer sur un refus laisse croire que
  /// l'action a eu lieu. L'attente est bornée : `reclaimExpiredLeases` tourne en
  /// tête de chaque vidange et rend la ligne abandonnable dès que son porteur
  /// est présumé mort, donc le second appui aboutira.
  ///
  /// **L'ordre reste remappage puis abandon, et c'est ce qui rend le refus
  /// rattrapable.** Les deux autres ordres sont pires :
  ///
  /// * abandonner d'abord expose une coupure entre les deux écritures où la
  ///   création a disparu alors que les prospects pointent encore vers le
  ///   parent local : ils partiraient vers une fiche qui n'existera jamais côté
  ///   serveur, et rien dans l'app ne pourrait plus les réparer ;
  /// * dans cet ordre-ci, un refus laisse un état que l'utilisateur peut
  ///   reprendre : les prospects sont repointés, la création est toujours en
  ///   tête de sa clé, donc rien ne part, et rappuyer sur le bouton reprend là
  ///   où on s'est arrêté. Le remappage est idempotent.
  ///
  /// **Et le doublon de représentant que ce refus pourrait faire craindre
  /// n'existe pas ici.** La feuille ne s'ouvre que sur une tête en `conflict`, et
  /// une tête en `conflict` empoisonne sa clé : le sélecteur l'ignore
  /// entièrement (ADR 0001 §2), donc la création ne peut pas repartir toute
  /// seule. Le seul cas où elle est en vol est celui où elle vient d'être
  /// relancée à la main, et elle repart alors sous son `opId` d'origine, que le
  /// serveur reconnaît. Aucun chemin ne produit une seconde fiche.
  ///
  /// [DiscardOutcome.notFound] est en revanche un succès : la création a déjà
  /// quitté la file, le but est atteint.
  Future<void> _attach(BuildContext context, WidgetRef ref) async {
    final String? serverId = lookup.representant?.id;
    if (serverId == null) return;
    await ref.read(syncEngineProvider).remapEntityId(row.entityId, serverId);
    // La création du représentant n'a plus lieu d'être : la fiche existe déjà
    // côté serveur. On l'abandonne SANS cascade : les prospects, eux, viennent
    // d'être repointés et doivent partir.
    final DiscardResult result = await ref
        .read(writeRepositoryProvider)
        .discardOwnCreateOnly(row.id);
    if (!context.mounted) return;
    if (result.outcome == DiscardOutcome.claimed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Envoi en cours : impossible de rattacher tout de suite. '
            'Réessayez dans quelques instants.',
          ),
        ),
      );
      return;
    }
    await ref.read(syncCoordinatorProvider.notifier).run(pull: false);
    if (context.mounted) Navigator.of(context).pop();
  }
}
