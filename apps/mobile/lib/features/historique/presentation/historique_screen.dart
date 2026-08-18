import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:flutter/services.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../data/local/database.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../../ui/widgets/offline_indicator.dart';
import '../../../ui/widgets/search_field.dart';
import '../../../ui/widgets/sync_badge.dart';
import '../../../ui/widgets/sync_status_icon.dart';

class HistoriqueScreen extends ConsumerWidget {
  const HistoriqueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<RepresentantSyncViewData>> rows = ref.watch(
      representantListProvider,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Historique'),
        actions: const <Widget>[
          OfflineIndicator(),
          SyncBadge(),
          SizedBox(width: CpiSpacing.xs),
        ],
      ),
      body: Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(
              CpiSpacing.md,
              CpiSpacing.sm,
              CpiSpacing.md,
              CpiSpacing.sm,
            ),
            child: CpiSearchField(
              initial: ref.read(historiqueSearchProvider),
              onChanged: ref.read(historiqueSearchProvider.notifier).set,
            ),
          ),
          Expanded(
            child: rows.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (Object e, StackTrace _) =>
                  Center(child: Text('Lecture impossible : $e')),
              data: (List<RepresentantSyncViewData> list) {
                if (list.isEmpty) return const _EmptyHistorique();
                return RefreshIndicator(
                  onRefresh: () async {
                    await HapticFeedback.selectionClick();
                    await ref.read(syncCoordinatorProvider.notifier).run();
                  },
                  child: ListView.builder(
                    padding: const EdgeInsets.only(bottom: CpiSpacing.xxl),
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: list.length,
                    itemBuilder: (BuildContext context, int index) => CpiListEntrance(
                      index: index,
                      child: _RepresentantTile(
                        key: ValueKey<String>(list[index].id),
                        data: list[index],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const _NewRepresentantBar(),
        ],
      ),
    );
  }
}

class _NewRepresentantBar extends StatelessWidget {
  const _NewRepresentantBar();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.xs,
        CpiSpacing.md,
        CpiSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(top: BorderSide(color: context.cpi.borderSubtle)),
      ),
      child: FilledButton.icon(
        onPressed: () {
          unawaited(HapticFeedback.selectionClick());
          context.pushOnce(Routes.newRepresentant);
        },
        icon: const Icon(PhosphorIconsRegular.plus, size: 20),
        label: const Text('Nouveau représentant'),
      ),
    );
  }
}

void _sayFailed(BuildContext context, Object error) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text('Suppression impossible. $error')));
}

class _RepresentantTile extends ConsumerWidget {
  const _RepresentantTile({super.key, required this.data});

  final RepresentantSyncViewData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final SyncStatus status = SyncStatus.parse(data.syncStatus ?? 'draft');

    return Dismissible(
      key: ValueKey<String>('dismiss-${data.id}'),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        color: context.cpi.syncFailed,
        padding: const EdgeInsets.only(right: CpiSpacing.lg),
        child: const Icon(PhosphorIconsRegular.trash, color: Colors.white),
      ),
      // L'écriture se fait AVANT le retrait de la ligne : dans `onDismissed`
      // elle partait en arrière-plan, la ligne quittait l'écran quoi qu'il
      // arrive et un refus de la base ne se voyait nulle part.
      confirmDismiss: (DismissDirection _) async {
        if (!await _confirmDelete(context, data.fullName)) return false;
        try {
          await ref.read(writeRepositoryProvider).deleteRepresentant(data.id);
        } on Object catch (e) {
          if (context.mounted) _sayFailed(context, e);
          return false;
        }
        ref.read(syncCoordinatorProvider.notifier).nudge();
        return true;
      },
      child: ExpansionTile(
        shape: const Border(),
        collapsedShape: const Border(),
        leading: _StatusButton(status: status, entityLabel: data.fullName),
        title: Text(data.fullName, style: theme.textTheme.titleSmall),
        subtitle: Text(Phone.format(data.phoneE164), style: theme.textTheme.bodySmall),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            IconButton(
              tooltip: 'Modifier',
              onPressed: () => context.pushOnce(
                '${Routes.newRepresentant}?id=${Uri.encodeComponent(data.id)}',
              ),
              icon: const Icon(PhosphorIconsRegular.pencilSimple, size: 20),
            ),
            IconButton(
              tooltip: 'Ajouter des prospects',
              onPressed: () => context.pushOnce(Routes.newProspectFor(data.id)),
              icon: const Icon(PhosphorIconsRegular.userPlus, size: 20),
            ),
            IconButton(
              tooltip: 'Ouvrir la fiche',
              onPressed: () => context.pushOnce(Routes.representantDetailFor(data.id)),
              icon: const Icon(PhosphorIconsRegular.caretRight, size: 20),
            ),
          ],
        ),
        children: <Widget>[_ProspectList(representantId: data.id)],
      ),
    );
  }

  static Future<bool> _confirmDelete(BuildContext context, String name) async {
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Supprimer ce représentant ?'),
        content: Text('$name et tous ses prospects seront supprimés.'),
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
    return ok ?? false;
  }
}

class _ProspectList extends ConsumerWidget {
  const _ProspectList({required this.representantId});

  final String representantId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<ProspectSyncViewData>> rows = ref.watch(
      prospectsForRepresentantProvider(representantId),
    );
    final ThemeData theme = Theme.of(context);

    return rows.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(CpiSpacing.md),
        child: LinearProgressIndicator(),
      ),
      error: (Object e, StackTrace _) => Padding(
        padding: const EdgeInsets.all(CpiSpacing.md),
        child: Text('Lecture impossible : $e'),
      ),
      data: (List<ProspectSyncViewData> list) {
        if (list.isEmpty) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(
              CpiSpacing.lg,
              0,
              CpiSpacing.md,
              CpiSpacing.sm,
            ),
            child: Text('Aucun prospect.', style: theme.textTheme.bodySmall),
          );
        }
        return Column(
          children: list
              .map(
                (ProspectSyncViewData p) => Dismissible(
                  key: ValueKey<String>('p-${p.id}'),
                  direction: DismissDirection.endToStart,
                  background: Container(
                    alignment: Alignment.centerRight,
                    color: context.cpi.syncFailed,
                    padding: const EdgeInsets.only(right: CpiSpacing.lg),
                    child: const Icon(PhosphorIconsRegular.trash, color: Colors.white),
                  ),
                  confirmDismiss: (DismissDirection _) async {
                    if (!await _confirm(context, '${p.prenom} ${p.nom}')) return false;
                    try {
                      await ref.read(writeRepositoryProvider).deleteProspect(p.id);
                    } on Object catch (e) {
                      if (context.mounted) _sayFailed(context, e);
                      return false;
                    }
                    ref.read(syncCoordinatorProvider.notifier).nudge();
                    return true;
                  },
                  child: ListTile(
                    contentPadding: const EdgeInsets.only(
                      left: CpiSpacing.lg,
                      right: CpiSpacing.md,
                    ),
                    leading: _StatusButton(
                      status: SyncStatus.parse(p.syncStatus ?? 'draft'),
                      entityLabel: '${p.prenom} ${p.nom}',
                    ),
                    title: Text('${p.prenom} ${p.nom}'),
                    subtitle: Text(Phone.format(p.phoneE164)),
                  ),
                ),
              )
              .toList(growable: false),
        );
      },
    );
  }

  static Future<bool> _confirm(BuildContext context, String name) async {
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Supprimer ce prospect ?'),
        content: Text('$name sera supprimé.'),
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
    return ok ?? false;
  }
}

class _StatusButton extends ConsumerWidget {
  const _StatusButton({required this.status, required this.entityLabel});

  final SyncStatus status;
  final String entityLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (status == SyncStatus.synced) {
      return SyncStatusIcon(status: status, size: 22);
    }
    return IconButton(
      tooltip: status.label,
      constraints: const BoxConstraints(
        minWidth: kCpiMinTouchTarget,
        minHeight: kCpiMinTouchTarget,
      ),
      onPressed: () => _explain(context, ref),
      icon: SyncStatusIcon(status: status, size: 22),
    );
  }

  void _explain(BuildContext context, WidgetRef ref) {
    switch (status) {
      case SyncStatus.conflict:
      case SyncStatus.failed:
        context.go(Routes.corrections);
      case SyncStatus.blocked:
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Représentant bloqué. Résolvez-le dans « À corriger ».'),
          ),
        );
      case SyncStatus.pending:
      case SyncStatus.syncing:
      case SyncStatus.draft:
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$entityLabel : en attente d\'envoi.'),
            action: SnackBarAction(
              label: 'Envoyer',
              onPressed: () => ref.read(syncCoordinatorProvider.notifier).run(),
            ),
          ),
        );
      case SyncStatus.synced:
        break;
    }
  }
}

class _EmptyHistorique extends StatelessWidget {
  const _EmptyHistorique();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(CpiSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Icon(
            PhosphorIconsDuotone.clockCounterClockwise,
            size: 56,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: CpiSpacing.md),
          Text('Aucun représentant', style: theme.textTheme.titleSmall),
          const SizedBox(height: CpiSpacing.lg),
          FilledButton.icon(
            onPressed: () => context.pushOnce(Routes.newRepresentant),
            icon: const Icon(PhosphorIconsRegular.plus, size: 20),
            label: const Text('Nouveau représentant'),
          ),
        ],
      ),
    );
  }
}
