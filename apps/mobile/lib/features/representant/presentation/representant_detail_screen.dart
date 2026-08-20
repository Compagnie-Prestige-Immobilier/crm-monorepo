import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../core/utils/relative_time.dart';
import '../../../core/utils/whatsapp.dart';
import '../../../data/local/database.dart';
import '../../../ui/widgets/offline_indicator.dart';
import '../../../ui/widgets/sync_status_icon.dart';
import '../../auth/auth_state.dart';

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
    final String profession = (data.profession ?? '').trim();

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
        _WhatsappRow(status: data.whatsappStatus, whatsappE164: data.whatsappE164),
        if (profession.isNotEmpty)
          _InfoRow(
            icon: PhosphorIconsRegular.briefcase,
            label: 'Profession',
            value: profession,
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
            unawaited(HapticFeedback.selectionClick());
            context.pushOnce(Routes.newProspectFor(data.id));
          },
          icon: const Icon(PhosphorIconsRegular.userPlus, size: 20),
          label: const Text('Nouveau prospect'),
        ),
        const SizedBox(height: CpiSpacing.xs),
        OutlinedButton.icon(
          onPressed: () {
            unawaited(HapticFeedback.selectionClick());
            context.pushOnce(
              '${Routes.newRepresentant}?id=${Uri.encodeComponent(data.id)}',
            );
          },
          icon: const Icon(PhosphorIconsRegular.pencilSimple, size: 20),
          label: const Text('Modifier'),
        ),
        const SizedBox(height: CpiSpacing.lg),
        Text('Prospects', style: theme.textTheme.titleSmall),
        const SizedBox(height: CpiSpacing.xxs),
        _ProspectList(representantId: data.id),
        const SizedBox(height: CpiSpacing.lg),
        Text('Commentaires', style: theme.textTheme.titleSmall),
        const SizedBox(height: CpiSpacing.xxs),
        RepresentantCommentThread(representantId: data.id),
      ],
    );
  }
}

/// Fil en AJOUT SEUL : rien ne se modifie, rien ne s'efface, donc rien à
/// arbitrer entre deux appareils.
///
/// Public parce qu'il est en bas d'un `ListView` : le balayage de débordement
/// peint 780 dp de haut et ne l'atteignait jamais.
class RepresentantCommentThread extends ConsumerStatefulWidget {
  const RepresentantCommentThread({super.key, required this.representantId});

  final String representantId;

  @override
  ConsumerState<RepresentantCommentThread> createState() =>
      _RepresentantCommentThreadState();
}

class _RepresentantCommentThreadState extends ConsumerState<RepresentantCommentThread> {
  final TextEditingController _controller = TextEditingController();
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _publish() async {
    final AuthState session = ref.read(authControllerProvider);
    final String? authorId = session.userId;
    final String body = _controller.text.trim();
    if (authorId == null || body.isEmpty || _sending) return;

    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref
          .read(writeRepositoryProvider)
          .addRepresentantComment(
            representantId: widget.representantId,
            body: body,
            authorId: authorId,
            authorName: session.fullName ?? 'Téléconseiller',
          );
      _controller.clear();
      await HapticFeedback.selectionClick();
    } on Object catch (e) {
      if (mounted) setState(() => _error = 'Commentaire non enregistré. $e');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final AsyncValue<List<RepresentantComment>> rows = ref.watch(
      representantCommentsProvider(widget.representantId),
    );
    final bool canPublish = !_sending && _controller.text.trim().isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        TextField(
          controller: _controller,
          minLines: 2,
          maxLines: 5,
          textCapitalization: TextCapitalization.sentences,
          onChanged: (String _) => setState(() {}),
          decoration: const InputDecoration(
            hintText: 'Ce qu\'il faut retenir de cette fiche',
            border: OutlineInputBorder(),
          ),
        ),
        if (_error != null) ...<Widget>[
          const SizedBox(height: CpiSpacing.xs),
          Semantics(
            liveRegion: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(
                  PhosphorIconsRegular.warningCircle,
                  size: 18,
                  color: theme.colorScheme.error,
                ),
                const SizedBox(width: CpiSpacing.xs),
                Expanded(
                  child: Text(
                    _error!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.error,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: CpiSpacing.xs),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.icon(
            onPressed: canPublish ? _publish : null,
            icon: const Icon(PhosphorIconsRegular.paperPlaneTilt, size: 20),
            label: const Text('Publier'),
          ),
        ),
        const SizedBox(height: CpiSpacing.sm),
        rows.when(
          loading: () => const LinearProgressIndicator(),
          error: (Object e, StackTrace _) => Text('Lecture impossible : $e'),
          data: (List<RepresentantComment> list) {
            if (list.isEmpty) {
              return Text(
                'Aucun commentaire. Notez ici ce que le prochain téléconseiller '
                'doit savoir avant d\'appeler.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: list
                  .map(
                    (RepresentantComment c) => Padding(
                      padding: const EdgeInsets.only(bottom: CpiSpacing.sm),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          Text(c.body, style: theme.textTheme.bodyMedium),
                          Text(
                            '${c.authorName} · ${relativeTime(c.clientCreatedAt)}',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                  .toList(growable: false),
            );
          },
        ),
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

/// `NON_DEMANDE` n'est PAS `AUCUN` : la fiche dit « non demandé » tant que la
/// question ne lui a pas été posée, et ne prétend jamais à une absence
/// constatée. Sur `MEME_NUMERO` la ligne dit le lien, pas le numéro : il n'est
/// stocké qu'une fois, une ligne plus haut.
class _WhatsappRow extends StatelessWidget {
  const _WhatsappRow({required this.status, this.whatsappE164});

  final String status;
  final String? whatsappE164;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final WhatsappStatus? known = WhatsappStatus.parse(status);
    final String? autre = known == WhatsappStatus.autreNumero ? whatsappE164 : null;

    if (autre != null) {
      return _CopyableRow(
        icon: PhosphorIconsRegular.whatsappLogo,
        label: 'WhatsApp',
        value: Phone.format(autre),
        copied: autre,
      );
    }
    return _InfoRow(
      icon: PhosphorIconsRegular.whatsappLogo,
      label: 'WhatsApp',
      // Une valeur ajoutée côté serveur s'affiche telle quelle plutôt que de
      // disparaître.
      value: known?.label ?? status,
      valueStyle: known == WhatsappStatus.nonDemande
          ? theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant)
          : null,
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
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueStyle,
  });

  final IconData icon;
  final String label;
  final String value;
  final TextStyle? valueStyle;

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
                Text(value, style: valueStyle ?? theme.textTheme.bodyLarge),
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
