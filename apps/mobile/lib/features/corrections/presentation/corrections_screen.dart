import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/connectivity.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/sync/api_port.dart';
import '../../../core/sync/outbox_status.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/local/database.dart';
import '../../../data/repositories/write_repository.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../../ui/widgets/offline_indicator.dart';
import 'discard_confirmation.dart';
import 'ownership_sheet.dart';

class CorrectionsScreen extends ConsumerWidget {
  const CorrectionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<OutboxData>> rows = ref.watch(needsAttentionProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('À corriger'),
        actions: const <Widget>[
          OfflineIndicator(),
          SizedBox(width: CpiSpacing.xs),
        ],
      ),
      body: Column(
        children: <Widget>[
          const _LastCycleFailure(),
          Expanded(child: _body(context, ref, rows)),
        ],
      ),
    );
  }

  Widget _body(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<List<OutboxData>> rows,
  ) {
    return rows.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (Object e, StackTrace _) => const Center(
        child: Padding(
          padding: EdgeInsets.all(CpiSpacing.xl),
          child: Text(
            'La file d\'envoi de cet appareil est illisible. Redémarrez '
            'l\'application ; si le message revient, prévenez votre '
            'responsable avant de saisir autre chose.',
            textAlign: TextAlign.center,
          ),
        ),
      ),
      data: (List<OutboxData> list) {
        if (list.isEmpty) return const _Empty();
        return RefreshIndicator(
          onRefresh: () async {
            await HapticFeedback.selectionClick();
            await ref.read(syncCoordinatorProvider.notifier).run(pull: false);
          },
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(
              CpiSpacing.md,
              CpiSpacing.sm,
              CpiSpacing.md,
              CpiSpacing.md,
            ),
            physics: const AlwaysScrollableScrollPhysics(),
            itemCount: list.length,
            separatorBuilder: (BuildContext context, int index) =>
                const SizedBox(height: CpiSpacing.xs),
            itemBuilder: (BuildContext context, int index) => CpiListEntrance(
              index: index,
              child: _CorrectionCard(row: list[index]),
            ),
          ),
        );
      },
    );
  }
}

class _LastCycleFailure extends ConsumerWidget {
  const _LastCycleFailure();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String? label = ref.watch(syncCoordinatorProvider).failureLabel;
    if (label == null) return const SizedBox.shrink();

    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.sm,
        CpiSpacing.md,
        0,
      ),
      padding: const EdgeInsets.all(CpiSpacing.sm),
      decoration: BoxDecoration(
        color: cpi.accentSurface,
        borderRadius: CpiRadius.brMd,
        border: Border.all(color: cpi.accentBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(PhosphorIconsRegular.info, size: 18, color: cpi.accentText),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(child: Text(label, style: theme.textTheme.bodySmall)),
        ],
      ),
    );
  }
}

class _CorrectionCard extends ConsumerStatefulWidget {
  const _CorrectionCard({required this.row});

  final OutboxData row;

  @override
  ConsumerState<_CorrectionCard> createState() => _CorrectionCardState();
}

class _CorrectionCardState extends ConsumerState<_CorrectionCard> {
  bool _busy = false;

  OutboxData get row => widget.row;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final bool isConflict = row.status == OutboxStatus.conflict;
    final Color tint = isConflict ? cpi.syncConflict : cpi.syncFailed;

    return Container(
      padding: const EdgeInsets.all(CpiSpacing.sm),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLowest,
        borderRadius: CpiRadius.brMd,
        border: Border.all(color: tint.withValues(alpha: 0.35)),
        boxShadow: CpiElevation.xs,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(
                isConflict
                    ? PhosphorIconsRegular.warningCircle
                    : PhosphorIconsRegular.xCircle,
                size: 20,
                color: tint,
              ),
              const SizedBox(width: CpiSpacing.xs),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(_title, style: theme.textTheme.titleSmall),
                    const SizedBox(height: 2),
                    Text(
                      row.lastErrorMsg ?? _fallbackMessage,
                      style: theme.textTheme.bodySmall,
                    ),
                    if (row.attempts > 0) ...<Widget>[
                      const SizedBox(height: 2),
                      Text(
                        '${row.attempts} tentative${row.attempts > 1 ? 's' : ''}'
                        '${row.lastErrorCode == null ? '' : ' · ${row.lastErrorCode}'}',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: CpiSpacing.xs),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: CpiSpacing.xs,
            children: <Widget>[
              if (_isOwnershipConflict)
                FilledButton.tonalIcon(
                  onPressed: _busy ? null : () => unawaited(_openOwnership()),
                  icon: _busy
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(PhosphorIconsRegular.userSwitch, size: 18),
                  label: const Text('Choisir'),
                )
              else
                TextButton.icon(
                  onPressed: _busy ? null : () => unawaited(_retry()),
                  icon: const Icon(
                    PhosphorIconsRegular.arrowClockwise,
                    size: 18,
                  ),
                  label: const Text('Réessayer'),
                ),
              TextButton.icon(
                onPressed: _busy ? null : _edit,
                icon: Icon(
                  row.entityType == 'representant'
                      ? PhosphorIconsRegular.pencilSimple
                      : PhosphorIconsRegular.listMagnifyingGlass,
                  size: 18,
                ),
                label: Text(_editLabel),
              ),
              TextButton.icon(
                onPressed: _busy ? null : () => unawaited(_discard()),
                icon: const Icon(PhosphorIconsRegular.trash, size: 18),
                label: const Text('Supprimer'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  bool get _isOwnershipConflict =>
      row.lastErrorCode == ServerErrorCodes.representantPhoneConflict ||
      row.lastErrorCode == ServerErrorCodes.representantOwnedByAnotherUser ||
      row.lastErrorCode == ServerErrorCodes.entityIdOwnedByAnotherUser;

  String get _title {
    final String what = row.entityType == 'representant'
        ? 'Représentant'
        : 'Prospect';
    final String verb = switch (row.op) {
      'create' => 'création',
      'update' => 'modification',
      _ => 'suppression',
    };
    final Object? decoded = _payload;
    final String name = decoded is Map
        ? (decoded['fullName'] as String? ??
              <String?>[
                decoded['prenom'] as String?,
                decoded['nom'] as String?,
              ].whereType<String>().join(' '))
        : '';
    return name.isEmpty ? '$what · $verb' : '$what · $name';
  }

  Object? get _payload {
    try {
      return jsonDecode(row.payload);
    } on FormatException {
      return null;
    }
  }

  String get _fallbackMessage => row.lastErrorCode == null
      ? 'Envoi impossible.'
      : 'Refusé (${row.lastErrorCode}).';

  Future<void> _retry() async {
    setState(() => _busy = true);
    try {
      await ref.read(writeRepositoryProvider).retryOperation(row.seq);
      await ref.read(syncCoordinatorProvider.notifier).run(pull: false);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openOwnership() async {
    final Object? decoded = _payload;
    final String? phone = decoded is Map ? decoded['phone'] as String? : null;
    if (phone == null) return;

    // Hors ligne, la recherche attend le délai de connexion puis deux essais :
    // trois quarts de minute sans rien à l'écran.
    if (ref.read(connectivityProvider) != CpiConnectivity.online) {
      _say('Arbitrage impossible hors ligne : il faut interroger le serveur.');
      return;
    }

    setState(() => _busy = true);
    RepresentantLookup? lookup;
    try {
      lookup = await ref.read(apiPortProvider).lookupRepresentantByPhone(phone);
    } on ApiException catch (e) {
      _say('Impossible de joindre le serveur : ${e.code}');
      return;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (!mounted) return;
    if (lookup.representant == null) {
      _say('Ce numéro n\'est plus enregistré ailleurs. Réessayez l\'envoi.');
      return;
    }
    await showOwnershipSheet(context: context, row: row, lookup: lookup);
  }

  void _say(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  String get _editLabel =>
      row.entityType == 'representant' ? 'Modifier' : 'Voir dans l\'historique';

  void _edit() {
    if (row.entityType == 'representant') {
      context.pushOnce(
        '${Routes.newRepresentant}?id=${Uri.encodeComponent(row.entityId)}',
      );
    } else {
      context.go(Routes.historique);
    }
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
    if (result.outcome == DiscardOutcome.claimed) {
      _say(
        'Envoi en cours : impossible d\'abandonner cette saisie tout de '
        'suite. Réessayez dans quelques instants.',
      );
    }
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(CpiSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Icon(
            PhosphorIconsDuotone.checkCircle,
            size: 56,
            color: context.cpi.success,
          ),
          const SizedBox(height: CpiSpacing.md),
          Text('Rien à corriger', style: theme.textTheme.titleSmall),
        ],
      ),
    );
  }
}
