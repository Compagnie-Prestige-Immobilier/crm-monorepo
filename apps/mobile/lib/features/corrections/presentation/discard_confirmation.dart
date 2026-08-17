import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';
import '../../../data/repositories/write_repository.dart';

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
