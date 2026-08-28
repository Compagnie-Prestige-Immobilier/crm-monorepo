import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';
import '../../../data/repositories/write_repository.dart';
import '../../../ui/widgets/cpi_kit.dart';

Future<bool> confirmDiscard({
  required BuildContext context,
  required WidgetRef ref,
  required int seq,
}) async {
  final DiscardPreview preview = await ref
      .read(writeRepositoryProvider)
      .previewDiscard(seq);
  if (!context.mounted) return false;
  final bool? ok = await cpiConfirm(
    context,
    title: 'Abandonner cet envoi ?',
    message: discardWarning(preview),
    confirmLabel: 'Supprimer',
    danger: true,
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
