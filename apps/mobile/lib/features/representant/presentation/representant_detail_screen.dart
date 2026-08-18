import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../data/local/database.dart';
import '../../../ui/widgets/offline_indicator.dart';
import '../../../ui/widgets/sync_status_icon.dart';

class RepresentantDetailScreen extends ConsumerWidget {
  const RepresentantDetailScreen({super.key, required this.representantId});

  final String representantId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<RepresentantSyncViewData?> fiche = ref.watch(
      representantDetailProvider(representantId),
    );

    return CpiPopScope(
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Représentant'),
          leading: const CpiBackButton(fallback: Routes.historique),
          actions: const <Widget>[
            OfflineIndicator(),
            SizedBox(width: CpiSpacing.xs),
          ],
        ),
        body: SafeArea(
          child: fiche.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (Object e, StackTrace _) =>
                Center(child: Text('Lecture impossible : $e')),
            data: (RepresentantSyncViewData? data) {
              if (data == null) return const _Missing();
              return _Fiche(data: data);
            },
          ),
        ),
      ),
    );
  }
}

/// Lecture seule : le contrat de synchronisation n'a pas de chemin d'écriture
/// mobile pour la relation. Une valeur ajoutée côté serveur s'affiche telle
/// quelle plutôt que de disparaître.
String relationLabel(String status) => switch (status) {
  'INCONNU' => 'Inconnue',
  'CONTACTE' => 'Contacté',
  'AMBASSADEUR' => 'Ambassadeur',
  'REFUS' => 'Refus',
  _ => status,
};

class _Fiche extends ConsumerWidget {
  const _Fiche({required this.data});

  final RepresentantSyncViewData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final SyncStatus status = SyncStatus.parse(data.syncStatus ?? 'draft');

    String? departement;
    for (final Departement d
        in ref.watch(departementsProvider(null)).value ?? const <Departement>[]) {
      if (d.id == data.departementId) departement = d.name;
    }

    String? ief;
    for (final Ief i in ref.watch(iefsProvider(null)).value ?? const <Ief>[]) {
      if (i.id == data.iefId) ief = i.name;
    }

    final String notes = (data.notes ?? '').trim();

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.md,
        CpiSpacing.md,
        CpiSpacing.xxl,
      ),
      children: <Widget>[
        Text(data.fullName, style: theme.textTheme.titleLarge),
        const SizedBox(height: CpiSpacing.xs),
        Wrap(
          spacing: CpiSpacing.sm,
          runSpacing: CpiSpacing.xxs,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: <Widget>[
            SyncStatusChip(status: status),
            _RelationChip(status: data.relationStatus),
          ],
        ),
        const SizedBox(height: CpiSpacing.md),
        _CopyableRow(
          icon: PhosphorIconsRegular.phone,
          label: 'Téléphone',
          value: Phone.format(data.phoneE164),
          copied: data.phoneE164,
        ),
        if (departement != null)
          _InfoRow(
            icon: PhosphorIconsRegular.mapPin,
            label: 'Département',
            value: departement,
          ),
        if (ief != null)
          _InfoRow(icon: PhosphorIconsRegular.buildings, label: 'IEF', value: ief),
        const SizedBox(height: CpiSpacing.lg),
        Text('Notes', style: theme.textTheme.titleSmall),
        const SizedBox(height: CpiSpacing.xxs),
        Text(
          notes.isEmpty ? 'Aucune note. Ajoutez-en une depuis « Modifier ».' : notes,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: notes.isEmpty ? theme.colorScheme.onSurfaceVariant : null,
          ),
        ),
        const SizedBox(height: CpiSpacing.lg),
        FilledButton.icon(
          onPressed: () {
            HapticFeedback.selectionClick();
            context.push(Routes.newProspectFor(data.id));
          },
          icon: const Icon(PhosphorIconsRegular.userPlus, size: 20),
          label: const Text('Nouveau prospect'),
        ),
        const SizedBox(height: CpiSpacing.xs),
        OutlinedButton.icon(
          onPressed: () {
            HapticFeedback.selectionClick();
            context.push('${Routes.newRepresentant}?id=${Uri.encodeComponent(data.id)}');
          },
          icon: const Icon(PhosphorIconsRegular.pencilSimple, size: 20),
          label: const Text('Modifier'),
        ),
        const SizedBox(height: CpiSpacing.lg),
        Text('Prospects', style: theme.textTheme.titleSmall),
        const SizedBox(height: CpiSpacing.xxs),
        _ProspectList(representantId: data.id),
      ],
    );
  }
}

/// Affiché en pastille et non en ligne d'information : la relation qualifie la
/// fiche, elle ne la décrit pas, et l'écran est déjà long.
class _RelationChip extends StatelessWidget {
  const _RelationChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Semantics(
      label: 'Relation : ${relationLabel(status)}',
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              PhosphorIconsRegular.handshake,
              size: 16,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: CpiSpacing.xxs + 2),
            Flexible(
              child: Text(
                relationLabel(status),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProspectList extends ConsumerWidget {
  const _ProspectList({required this.representantId});

  final String representantId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final AsyncValue<List<ProspectSyncViewData>> rows = ref.watch(
      prospectsForRepresentantProvider(representantId),
    );

    return rows.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: CpiSpacing.sm),
        child: LinearProgressIndicator(),
      ),
      error: (Object e, StackTrace _) => Text('Lecture impossible : $e'),
      data: (List<ProspectSyncViewData> list) {
        if (list.isEmpty) {
          return Text(
            'Aucun prospect. Utilisez « Nouveau prospect » pour en saisir un.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: list
              .map((ProspectSyncViewData p) {
                final SyncStatus status = SyncStatus.parse(p.syncStatus ?? 'draft');
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: CpiSpacing.xs),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: SyncStatusIcon(status: status, size: 20),
                      ),
                      const SizedBox(width: CpiSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: <Widget>[
                            Text(
                              '${p.prenom} ${p.nom}',
                              style: theme.textTheme.titleSmall,
                            ),
                            Text(
                              '${Phone.format(p.phoneE164)} · ${status.label}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              })
              .toList(growable: false),
        );
      },
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: CpiSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(icon, size: 20, color: theme.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(width: CpiSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  label,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                Text(value, style: theme.textTheme.bodyLarge),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CopyableRow extends StatelessWidget {
  const _CopyableRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.copied,
  });

  final IconData icon;
  final String label;
  final String value;
  final String copied;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '$label : $value. Copier.',
      child: ExcludeSemantics(
        child: InkWell(
          onTap: () async {
            await Clipboard.setData(ClipboardData(text: copied));
            await HapticFeedback.selectionClick();
            if (!context.mounted) return;
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(const SnackBar(content: Text('Numéro copié')));
          },
          child: _InfoRow(icon: icon, label: label, value: value),
        ),
      ),
    );
  }
}

class _Missing extends StatelessWidget {
  const _Missing();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(CpiSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              PhosphorIconsDuotone.userMinus,
              size: 56,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: CpiSpacing.md),
            Text(
              'Fiche introuvable',
              style: theme.textTheme.titleSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: CpiSpacing.xs),
            Text(
              'Elle a été supprimée sur cet appareil.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: CpiSpacing.lg),
            FilledButton(
              onPressed: () => context.go(Routes.historique),
              child: const Text('Voir l\'historique'),
            ),
          ],
        ),
      ),
    );
  }
}
