import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/sync/api_port.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/local/database.dart';
import '../../../data/repositories/write_repository.dart';
import 'discard_confirmation.dart';

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

class _OwnershipSheet extends ConsumerStatefulWidget {
  const _OwnershipSheet({required this.row, required this.lookup});

  final OutboxData row;
  final RepresentantLookup lookup;

  @override
  ConsumerState<_OwnershipSheet> createState() => _OwnershipSheetState();
}

class _OwnershipSheetState extends ConsumerState<_OwnershipSheet> {
  bool _busy = false;

  OutboxData get row => widget.row;
  RepresentantLookup get lookup => widget.lookup;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final String owner =
        lookup.ownedByCommercialName ?? 'un autre téléconseiller';
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
              onPressed: _busy ? null : () => unawaited(_attach()),
              icon: _busy
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(PhosphorIconsRegular.linkSimple, size: 20),
              label: const Text('Rattacher mes prospects'),
            ),
            const SizedBox(height: CpiSpacing.xs),
            OutlinedButton.icon(
              onPressed: _busy ? null : _correct,
              icon: const Icon(PhosphorIconsRegular.pencilSimple, size: 20),
              label: const Text('Corriger le numéro'),
            ),
            const SizedBox(height: CpiSpacing.xs),
            TextButton.icon(
              onPressed: _busy ? null : () => unawaited(_discard()),
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

  void _correct() {
    Navigator.of(context).pop();
    context.pushOnce(
      '${Routes.newRepresentant}?id=${Uri.encodeComponent(row.entityId)}',
    );
  }

  Future<void> _discard() async {
    final bool ok = await confirmDiscard(
      context: context,
      ref: ref,
      seq: row.seq,
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    final DiscardResult result;
    try {
      result = await ref.read(writeRepositoryProvider).discardOperation(row.seq);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (!mounted) return;
    if (result.outcome == DiscardOutcome.claimed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Envoi en cours : réessayez dans quelques instants.'),
        ),
      );
      return;
    }
    Navigator.of(context).pop();
  }

  Future<void> _attach() async {
    final String? serverId = lookup.representant?.id;
    if (serverId == null) return;
    setState(() => _busy = true);
    final DiscardResult result;
    try {
      await ref.read(syncEngineProvider).remapEntityId(row.entityId, serverId);
      result = await ref
          .read(writeRepositoryProvider)
          .discardOwnCreateOnly(row.id);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (!mounted) return;
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
    if (mounted) Navigator.of(context).pop();
  }
}
