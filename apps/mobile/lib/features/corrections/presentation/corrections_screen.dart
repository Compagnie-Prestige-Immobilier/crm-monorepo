import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/sync/api_port.dart';
import '../../../core/sync/outbox_status.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/local/database.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import 'ownership_sheet.dart';

/// « À corriger » : la file des opérations en `conflict` ou `failed`.
///
/// Un écran dédié et pas un badge dans une liste. Une opération bloquée bloque
/// **toute sa partition** : le représentant fautif et l'ensemble de ses
/// prospects cessent de partir (ADR 0001 §2). Sans un endroit où la voir et la
/// résoudre, l'utilisateur constate seulement que son compteur d'attente ne
/// descend plus, sans savoir pourquoi ni quoi faire.
///
/// Trois actions par ligne, jamais plus : **Réessayer**, **Modifier**,
/// **Supprimer**. Un quatrième choix sur un écran d'erreur transforme un
/// problème technique en décision, et l'utilisateur n'en a pas les moyens.
class CorrectionsScreen extends ConsumerWidget {
  const CorrectionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<OutboxData>> rows = ref.watch(needsAttentionProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('À corriger')),
      body: rows.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (Object e, StackTrace _) => Center(child: Text('Lecture impossible : $e')),
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
      ),
    );
  }
}

class _CorrectionCard extends ConsumerWidget {
  const _CorrectionCard({required this.row});

  final OutboxData row;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
                  onPressed: () => _openOwnership(context, ref),
                  icon: const Icon(PhosphorIconsRegular.userSwitch, size: 18),
                  label: const Text('Choisir'),
                )
              else
                TextButton.icon(
                  onPressed: () async {
                    await ref.read(writeRepositoryProvider).retryOperation(row.seq);
                    await ref.read(syncCoordinatorProvider.notifier).run(pull: false);
                  },
                  icon: const Icon(PhosphorIconsRegular.arrowClockwise, size: 18),
                  label: const Text('Réessayer'),
                ),
              TextButton.icon(
                onPressed: () => _edit(context),
                icon: const Icon(PhosphorIconsRegular.pencilSimple, size: 18),
                label: const Text('Modifier'),
              ),
              TextButton.icon(
                onPressed: () => _discard(context, ref),
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
    final String what = row.entityType == 'representant' ? 'Représentant' : 'Prospect';
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

  String get _fallbackMessage =>
      row.lastErrorCode == null ? 'Envoi impossible.' : 'Refusé (${row.lastErrorCode}).';

  Future<void> _openOwnership(BuildContext context, WidgetRef ref) async {
    final Object? decoded = _payload;
    final String? phone = decoded is Map ? decoded['phone'] as String? : null;
    if (phone == null) return;

    RepresentantLookup? lookup;
    try {
      lookup = await ref.read(apiPortProvider).lookupRepresentantByPhone(phone);
    } on ApiException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Impossible de joindre le serveur : ${e.code}')),
      );
      return;
    }
    if (!context.mounted || lookup.representant == null) return;
    await showOwnershipSheet(context: context, row: row, lookup: lookup);
  }

  void _edit(BuildContext context) {
    if (row.entityType == 'representant') {
      context.push('${Routes.newRepresentant}?id=${Uri.encodeComponent(row.entityId)}');
    } else {
      context.go(Routes.historique);
    }
  }

  Future<void> _discard(BuildContext context, WidgetRef ref) async {
    // On annonce le nombre exact d'opérations emportées. Abandonner la création
    // d'un représentant emporte tous ses prospects : sans cette cascade, ils
    // partiraient vers un parent qui n'existera jamais côté serveur, qui
    // répondrait `REPRESENTANT_NOT_FOUND` indéfiniment.
    final int cascade = await _countCascade(ref);
    if (!context.mounted) return;
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Abandonner cet envoi ?'),
        content: Text(
          cascade > 1
              ? '$cascade opérations liées seront supprimées définitivement.'
              : 'Cette saisie sera supprimée définitivement.',
        ),
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
    if (ok != true) return;
    await ref.read(writeRepositoryProvider).discardOperation(row.seq);
  }

  Future<int> _countCascade(WidgetRef ref) async {
    if (row.op != 'create' || row.dependencyKey == null) return 1;
    final List<OutboxData> all = await ref
        .read(needsAttentionProvider.future)
        .catchError((Object _) => const <OutboxData>[]);
    // Approximation volontaire à l'affichage : le compte exact est fait dans la
    // transaction de suppression, seule source de vérité.
    return all
        .where((OutboxData o) => o.dependencyKey == row.dependencyKey)
        .length
        .clamp(1, 999);
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
          Icon(PhosphorIconsDuotone.checkCircle, size: 56, color: context.cpi.success),
          const SizedBox(height: CpiSpacing.md),
          Text('Rien à corriger', style: theme.textTheme.titleSmall),
        ],
      ),
    );
  }
}
