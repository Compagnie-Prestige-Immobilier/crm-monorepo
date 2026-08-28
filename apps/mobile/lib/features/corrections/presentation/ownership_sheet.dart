import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/sync/api_port.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/local/database.dart';
import '../../../data/repositories/write_repository.dart';
import '../../../ui/widgets/cpi_kit.dart';
import 'discard_confirmation.dart';

Future<void> showOwnershipSheet({
  required BuildContext context,
  required OutboxData row,
  required RepresentantLookup lookup,
}) {
  return showCpiSheet<void>(
    context,
    title: 'Numéro déjà enregistré',
    builder: (BuildContext context) =>
        _OwnershipSheet(row: row, lookup: lookup),
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
  String? _refus;

  OutboxData get row => widget.row;
  RepresentantLookup get lookup => widget.lookup;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final String owner =
        lookup.ownedByCommercialName ?? 'un autre téléconseiller';
    final String? departement = lookup.representant?.departementName;
    final String where = departement == null ? '' : ' ($departement)';

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          'Ce numéro est déjà enregistré par $owner$where.',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        if (_refus != null) ...<Widget>[
          const SizedBox(height: CpiSpacing.md),
          Semantics(
            liveRegion: true,
            child: FAlert(
              variant: FAlertVariant.destructive,
              icon: const Icon(PhosphorIconsRegular.warningCircle),
              title: Text(_refus!),
            ),
          ),
        ],
        const SizedBox(height: CpiSpacing.lg),
        CpiButton(
          'Rattacher mes prospects',
          icon: PhosphorIconsRegular.linkSimple,
          loading: _busy,
          onPressed: () => unawaited(_attach()),
        ),
        const SizedBox(height: CpiSpacing.xs),
        CpiButton(
          'Corriger le numéro',
          variant: CpiButtonVariant.secondary,
          icon: PhosphorIconsRegular.pencilSimple,
          onPressed: _busy ? null : _correct,
        ),
        const SizedBox(height: CpiSpacing.xs),
        CpiButton(
          'Supprimer cette saisie',
          variant: CpiButtonVariant.danger,
          icon: PhosphorIconsRegular.trash,
          onPressed: _busy ? null : () => unawaited(_discard()),
        ),
      ],
    );
  }

  void _correct() {
    Navigator.of(context).pop();
    context.pushOnce(
      '${Routes.newRepresentant}?id=${Uri.encodeComponent(row.entityId)}',
    );
  }

  /// Le refus reste dans la feuille, à côté du bouton qui vient d'échouer : un
  /// message posé ailleurs disparaît sous la feuille encore ouverte.
  void _refuse(String message) => setState(() => _refus = message);

  Future<void> _discard() async {
    final bool ok = await confirmDiscard(
      context: context,
      ref: ref,
      seq: row.seq,
    );
    if (!ok || !mounted) return;
    setState(() {
      _busy = true;
      _refus = null;
    });
    final DiscardResult result;
    try {
      result = await ref
          .read(writeRepositoryProvider)
          .discardOperation(row.seq);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (!mounted) return;
    if (result.outcome == DiscardOutcome.claimed) {
      _refuse('Envoi en cours : réessayez dans quelques instants.');
      return;
    }
    Navigator.of(context).pop();
  }

  Future<void> _attach() async {
    final String? serverId = lookup.representant?.id;
    if (serverId == null) return;
    setState(() {
      _busy = true;
      _refus = null;
    });
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
      _refuse(
        'Envoi en cours : impossible de rattacher tout de suite. '
        'Réessayez dans quelques instants.',
      );
      return;
    }
    await ref.read(syncCoordinatorProvider.notifier).run(pull: false);
    if (mounted) Navigator.of(context).pop();
  }
}
