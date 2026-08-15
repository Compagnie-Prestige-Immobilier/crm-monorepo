import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';
import '../../../data/repositories/write_repository.dart';

/// La confirmation d'abandon, **une seule fois pour les deux endroits qui
/// abandonnent**.
///
/// ═══ POURQUOI ELLE N'EST PAS ÉCRITE DANS LA CARTE ═══
///
/// Deux écrans appellent `WriteRepository.discardOperation` sur exactement la
/// même ligne : la carte de « À corriger », et la feuille d'arbitrage qui
/// s'ouvre depuis cette carte. La carte demandait confirmation ; la feuille
/// supprimait au premier appui, sans un mot. Or la feuille ne s'ouvre QUE sur
/// une création de représentant en `conflict`, c'est-à-dire sur la seule ligne
/// de toute la file dont l'abandon emporte une cascade : un appui sur
/// « Supprimer cette saisie » détruisait le représentant et l'intégralité des
/// prospects saisis sous lui, définitivement, sans retour possible et sans que
/// rien à l'écran ne l'ait annoncé.
///
/// Redemander la confirmation à chaque appelant, c'est accepter qu'un troisième
/// appelant l'oublie à son tour. Le geste destructeur et sa question vivent donc
/// dans la même fonction, et le compte annoncé vient de
/// [WriteRepository.previewDiscard], donc du même code que la suppression.
Future<bool> confirmDiscard({
  required BuildContext context,
  required WidgetRef ref,
  required int seq,
}) async {
  final DiscardPreview preview = await ref
      .read(writeRepositoryProvider)
      .previewDiscard(seq);
  if (!context.mounted) return false;
  final bool? ok = await showDialog<bool>(
    context: context,
    builder: (BuildContext context) => AlertDialog(
      title: const Text('Abandonner cet envoi ?'),
      content: Text(discardWarning(preview)),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Annuler'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Supprimer'),
        ),
      ],
    ),
  );
  return ok == true;
}

/// La phrase de la boîte, séparée pour être lisible par un test sans mise en
/// scène d'un arbre de widgets.
///
/// **Elle nomme les fiches, pas les opérations.** « 21 opérations liées » ne dit
/// rien à un commercial : « ce représentant et les 20 prospects saisis sous
/// lui » nomme ce qu'il faudra ressaisir, qui est la seule chose qu'il ait à
/// évaluer avant de confirmer.
String discardWarning(DiscardPreview preview) {
  if (preview.prospects > 0) {
    final String s = preview.prospects > 1 ? 's' : '';
    return 'Ce représentant et les ${preview.prospects} prospect$s saisi$s '
        'sous lui seront supprimés définitivement. '
        'Ces saisies seront à refaire.';
  }
  if (preview.operations > 1) {
    return '${preview.operations} opérations liées seront supprimées '
        'définitivement.';
  }
  return 'Cette saisie sera supprimée définitivement.';
}
