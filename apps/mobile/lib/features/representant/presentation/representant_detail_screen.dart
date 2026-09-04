import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/appel.dart';
import '../../../core/utils/phone.dart';
import '../../../core/utils/relative_time.dart';
import '../../../core/utils/whatsapp.dart';
import '../../../data/local/database.dart';
import '../../../data/repositories/write_repository.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_forui.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../../../ui/widgets/sync_status_icon.dart';
import '../../auth/auth_state.dart';
import '../../../ui/async_value_x.dart';

class RepresentantDetailScreen extends ConsumerWidget {
  const RepresentantDetailScreen({super.key, required this.representantId});

  final String representantId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<RepresentantSyncViewData?> fiche = ref.watch(
      representantDetailProvider(representantId),
    );
    final RepresentantSyncViewData? data = fiche.value;

    return CpiPopScope(
      child: CpiScaffold(
        title: data?.fullName ?? 'Fiche',
        leading: const CpiBackButton(fallback: Routes.historique),
        footer: data == null ? null : _PiedDeFiche(data: data),
        body: fiche.whenEchecDAbord(
          loading: () => const Center(child: FCircularProgress()),
          error: (Object e, StackTrace _) => CpiErrorState(
            message: 'Cette fiche n\'a pas pu être lue. ${messageErreur(e)}',
            onRetry: () =>
                ref.invalidate(representantDetailProvider(representantId)),
          ),
          data: (RepresentantSyncViewData? data) {
            if (data == null) return const _Missing();
            return _Fiche(data: data);
          },
        ),
      ),
    );
  }
}

/// Lecture seule : le contrat de synchronisation n'a pas de chemin d'écriture
/// mobile pour la relation. Une valeur ajoutée côté serveur s'affiche telle
/// quelle plutôt que de disparaître.
String relationLabel(String status) => switch (status) {
  'INCONNU' => 'Pas encore contacté',
  'CONTACTE' => 'Contacté',
  'AMBASSADEUR' => 'A accepté',
  'REFUS' => 'Refus',
  _ => status,
};

String libelleIssueRepresentant(String code) => switch (code) {
  'REACHED' => 'Joint',
  'PROSPECTS_PROMISED' => 'Fiches promises',
  'UNREACHABLE' => 'Injoignable',
  'CALLBACK' => 'À rappeler',
  'REFUSED' => 'Refus',
  'WRONG_NUMBER' => 'Faux numéro',
  'OTHER' => 'Autre',
  _ => code,
};

/// Même pastille que le web : le statut de qualification est le libellé,
/// la relation ne décide que de la couleur et de l'étoile. Une fiche jamais
/// qualifiée retombe sur le libellé de la relation.
/// Le ton d'un effet de statut ou d'une issue d'appel : joint en vert, à
/// rappeler en orange, refus en rouge, le reste neutre.
CpiTone toneDeLEffet(String? effet) => switch (effet) {
  'REACHED' || 'PROSPECTS_PROMISED' => CpiTone.success,
  'SCHEDULE_CALLBACK' || 'CALLBACK' => CpiTone.warning,
  'REFUSED' => CpiTone.danger,
  _ => CpiTone.neutral,
};

/// La pastille dit où en est l'appel : le statut de qualification, sinon
/// l'issue du dernier appel, sinon « Jamais appelé ». La relation ne parle
/// pas, elle se voit : étoile pour qui a accepté, interdit pour qui a refusé.
class StatutTag extends StatelessWidget {
  const StatutTag({
    required this.relationStatus,
    required this.statutLabel,
    this.statutEffect,
    this.lastCallOutcome,
    super.key,
  });

  final String relationStatus;
  final String? statutLabel;
  final String? statutEffect;
  final String? lastCallOutcome;

  @override
  Widget build(BuildContext context) {
    final String? issue = lastCallOutcome;
    final String libelle =
        statutLabel ??
        (issue == null ? 'Jamais appelé' : libelleIssueRepresentant(issue));
    final CpiTone tone = toneDeLEffet(statutLabel == null ? issue : statutEffect);
    final bool etoile = relationStatus == 'AMBASSADEUR';
    final bool refus = relationStatus == 'REFUS';
    return Semantics(
      label:
          'Statut : $libelle'
          '${etoile ? ', a accepté' : ''}${refus ? ', a refusé' : ''}',
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            if (etoile) ...<Widget>[
              Icon(
                PhosphorIconsFill.star,
                size: CpiIconSize.xs,
                color: context.cpi.success,
              ),
              const SizedBox(width: CpiSpacing.xxs),
            ],
            if (refus) ...<Widget>[
              Icon(
                PhosphorIconsFill.prohibit,
                size: CpiIconSize.xs,
                color: Theme.of(context).colorScheme.error,
              ),
              const SizedBox(width: CpiSpacing.xxs),
            ],
            CpiTag(libelle, tone: tone),
          ],
        ),
      ),
    );
  }
}

String ouiNonNsp(bool? value) {
  if (value == null) return 'Indéterminé';
  return value ? 'Oui' : 'Non';
}

class _PiedDeFiche extends ConsumerWidget {
  const _PiedDeFiche({required this.data});

  final RepresentantSyncViewData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) => CpiActionBar(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        CpiButton(
          'Appeler',
          icon: PhosphorIconsRegular.phoneCall,
          onPressed: () => unawaited(appelerNumero(context, data.phoneE164)),
        ),
        const SizedBox(height: CpiSpacing.xs),
        CpiButton(
          'Ajouter des prospects',
          variant: CpiButtonVariant.secondary,
          icon: PhosphorIconsRegular.userPlus,
          onPressed: () => context.pushOnce(Routes.newProspectFor(data.id)),
        ),
        const SizedBox(height: CpiSpacing.xs),
        Builder(
          builder: (BuildContext context) => CpiButton(
            'Autres actions',
            variant: CpiButtonVariant.ghost,
            icon: PhosphorIconsRegular.dotsThree,
            onPressed: () => unawaited(_autresActions(context, ref, data)),
          ),
        ),
      ],
    ),
  );
}

/// Les gestes rares de la fiche, nommés : rien ne se déclenche plus par un
/// balayage ni par un appui long.
Future<void> _autresActions(
  BuildContext context,
  WidgetRef ref,
  RepresentantSyncViewData data,
) async {
  final String? choix = await showCpiSheet<String>(
    context,
    title: 'Autres actions',
    builder: (BuildContext sheet) => CpiCard.rows(<CpiRow>[
      CpiRow(
        leading: const Icon(
          PhosphorIconsRegular.pencilSimple,
          size: CpiIconSize.md,
        ),
        title: 'Modifier',
        onTap: () => Navigator.of(sheet).pop('modifier'),
      ),
      CpiRow(
        leading: const Icon(
          PhosphorIconsRegular.phoneCall,
          size: CpiIconSize.md,
        ),
        title: 'Résultat de l\'appel',
        onTap: () => Navigator.of(sheet).pop('qualifier'),
      ),
      CpiRow(
        leading: const Icon(PhosphorIconsRegular.trash, size: CpiIconSize.md),
        title: 'Supprimer cette fiche',
        danger: true,
        onTap: () => Navigator.of(sheet).pop('supprimer'),
      ),
    ]),
  );
  if (choix == null || !context.mounted) return;
  switch (choix) {
    case 'modifier':
      context.pushOnce(Routes.representantFormFor(data.id));
    case 'qualifier':
      context.pushOnce(Routes.representantQualificationFor(data.id));
    case 'supprimer':
      await _supprimer(context, ref, data);
  }
}

Future<void> _supprimer(
  BuildContext context,
  WidgetRef ref,
  RepresentantSyncViewData data,
) async {
  // `ref` se lit AVANT la confirmation : la fiche se démonte avec la
  // suppression, et un `ref` lu après appartiendrait à un widget mort.
  final SyncCoordinator sync = ref.read(syncCoordinatorProvider.notifier);
  final WriteRepository writes = ref.read(writeRepositoryProvider);
  final bool? ok = await cpiConfirm(
    context,
    title: 'Supprimer ce représentant ?',
    message: '${data.fullName} et tous ses prospects seront supprimés.',
    confirmLabel: 'Supprimer',
    danger: true,
  );
  if (ok != true) return;
  try {
    await writes.deleteRepresentant(data.id);
  } on Object catch (e) {
    if (context.mounted) {
      cpiToast(context, 'Suppression impossible. $e', persistent: true);
    }
    return;
  }
  sync.nudge();
  if (context.mounted) context.go(Routes.historique);
}

class _Fiche extends ConsumerWidget {
  const _Fiche({required this.data});

  final RepresentantSyncViewData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final SyncStatus status = SyncStatus.parse(data.syncStatus ?? 'draft');

    String? departement;
    for (final Departement d
        in ref.watch(departementsProvider(null)).value ??
            const <Departement>[]) {
      if (d.id == data.departementId) departement = d.name;
    }

    String? ief;
    for (final Ief i in ref.watch(iefsProvider(null)).value ?? const <Ief>[]) {
      if (i.id == data.iefId) ief = i.name;
    }

    final String notes = (data.notes ?? '').trim();
    final String profession = (data.profession ?? '').trim();
    final WhatsappStatus? whatsapp = WhatsappStatus.parse(data.whatsappStatus);
    final String? whatsappAutre = whatsapp == WhatsappStatus.autreNumero
        ? data.whatsappE164
        : null;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        0,
        CpiSpacing.md,
        CpiSpacing.xxl,
      ),
      children: <Widget>[
        Wrap(
          spacing: CpiSpacing.sm,
          runSpacing: CpiSpacing.xxs,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: <Widget>[
            if (status.aSignaler != null) SyncStatusChip(status: status),
            StatutTag(
              relationStatus: data.relationStatus,
              statutLabel: data.statutQualificationLabel,
              statutEffect: data.statutQualificationEffect,
              lastCallOutcome: data.lastCallOutcome,
            ),
          ],
        ),
        const SizedBox(height: CpiSpacing.md),
        CpiCard.rows(<CpiRow>[
          _copiable(
            context,
            icon: PhosphorIconsRegular.phone,
            label: 'Téléphone',
            value: Phone.format(data.phoneE164),
            copied: data.phoneE164,
          ),
          if (departement != null)
            _info(
              icon: PhosphorIconsRegular.mapPin,
              label: 'Département',
              value: departement,
            ),
          // `NON_DEMANDE` n'est PAS `AUCUN` : la fiche dit « non demandé » tant
          // que la question ne lui a pas été posée, et ne prétend jamais à une
          // absence constatée. Sur `MEME_NUMERO` la ligne dit le lien, pas le
          // numéro : il n'est stocké qu'une fois, une ligne plus haut.
          if (whatsappAutre != null)
            _copiable(
              context,
              icon: PhosphorIconsRegular.whatsappLogo,
              label: 'WhatsApp',
              value: Phone.format(whatsappAutre),
              copied: whatsappAutre,
            )
          else
            _info(
              icon: PhosphorIconsRegular.whatsappLogo,
              label: 'WhatsApp',
              // Une valeur ajoutée côté serveur s'affiche telle quelle plutôt
              // que de disparaître.
              value: whatsapp?.label ?? data.whatsappStatus,
            ),
          if (profession.isNotEmpty)
            _info(
              icon: PhosphorIconsRegular.briefcase,
              label: 'Profession',
              value: profession,
            ),
          if ((data.prenom ?? '').trim().isNotEmpty)
            _info(
              icon: PhosphorIconsRegular.identificationCard,
              label: 'Prénom',
              value: data.prenom!.trim(),
            ),
          if ((data.etablissement ?? '').trim().isNotEmpty)
            _info(
              icon: PhosphorIconsRegular.buildings,
              label: 'Établissement',
              value: data.etablissement!.trim(),
            ),
          if ((data.syndicat ?? '').trim().isNotEmpty)
            _info(
              icon: PhosphorIconsRegular.usersThree,
              label: 'Syndicat',
              value: data.syndicat!.trim(),
            ),
          _info(
            icon: PhosphorIconsRegular.info,
            label: 'Connaît l’UES',
            value: ouiNonNsp(data.connaitUes),
          ),
          _info(
            icon: PhosphorIconsRegular.phoneCall,
            label: 'Déjà contacté',
            value: ouiNonNsp(data.contacte),
          ),
          if (ief != null)
            _info(
              icon: PhosphorIconsRegular.buildings,
              label: 'Inspection',
              value: ief,
            ),
        ]),
        _ProspectList(representantId: data.id),
        const _Section('Notes'),
        CpiCard(
          child: Text(
            notes.isEmpty ? 'Aucune note.' : notes,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: notes.isEmpty ? theme.colorScheme.onSurfaceVariant : null,
            ),
          ),
        ),
        const _Section('Commentaires'),
        RepresentantCommentThread(representantId: data.id),
      ],
    );
  }

  static CpiRow _info({
    required IconData icon,
    required String label,
    required String value,
  }) => CpiRow(
    leading: Icon(icon, size: CpiIconSize.md),
    title: label,
    subtitle: value,
  );

  static CpiRow _copiable(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String value,
    required String copied,
  }) => CpiRow(
    leading: Icon(icon, size: CpiIconSize.md),
    title: label,
    subtitle: value,
    trailing: const Icon(
      PhosphorIconsRegular.copy,
      size: CpiIconSize.md,
      semanticLabel: 'Copier',
    ),
    onTap: () async {
      await Clipboard.setData(ClipboardData(text: copied));
      await HapticFeedback.selectionClick();
      if (!context.mounted) return;
      cpiToast(context, 'Numéro copié');
    },
  );
}

/// Intertitre de la fiche : le même écart au-dessus, la même graisse.
class _Section extends StatelessWidget {
  const _Section(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(0, CpiSpacing.lg, 0, CpiSpacing.xs),
    child: Semantics(
      header: true,
      child: Text(text, style: Theme.of(context).textTheme.titleSmall),
    ),
  );
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

class _RepresentantCommentThreadState
    extends ConsumerState<RepresentantCommentThread> {
  final TextEditingController _controller = TextEditingController();
  bool _sending = false;

  /// Le champ ne s'ouvre qu'à la demande : lire le fil est le geste courant,
  /// écrire est l'exception.
  bool _composing = false;
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
      if (mounted) setState(() => _composing = false);
    } on Object catch (e) {
      if (mounted) setState(() => _error = 'Commentaire non enregistré. $e');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) {
      final ThemeData theme = Theme.of(context);
      final AsyncValue<List<RepresentantComment>> rows = ref.watch(
        representantCommentsProvider(widget.representantId),
      );
      final bool canPublish = !_sending && _controller.text.trim().isNotEmpty;

      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (!_composing)
            CpiButton(
              'Ajouter un commentaire',
              variant: CpiButtonVariant.secondary,
              icon: PhosphorIconsRegular.chatCircleText,
              onPressed: () => setState(() => _composing = true),
            )
          else ...<Widget>[
            CpiField(
              label: 'Nouveau commentaire',
              controller: _controller,
              hint: 'Ce qu\'il faut retenir de cette fiche',
              maxLines: 5,
              autofocus: true,
              textCapitalization: TextCapitalization.sentences,
              onChanged: (String _) => setState(() {}),
            ),
            if (_error != null) ...<Widget>[
              const SizedBox(height: CpiSpacing.xs),
              Semantics(
                liveRegion: true,
                child: FAlert(
                  variant: FAlertVariant.destructive,
                  icon: const Icon(PhosphorIconsRegular.warningCircle),
                  title: Text(_error!),
                ),
              ),
            ],
            const SizedBox(height: CpiSpacing.xs),
            Align(
              alignment: Alignment.centerRight,
              child: CpiButton(
                'Publier',
                icon: PhosphorIconsRegular.paperPlaneTilt,
                expand: false,
                onPressed: canPublish ? _publish : null,
              ),
            ),
          ],
          const SizedBox(height: CpiSpacing.sm),
          rows.whenEchecDAbord(
            loading: () => const FProgress(),
            error: (Object e, StackTrace _) => CpiErrorState(
              message:
                  'Les commentaires n\'ont pas pu être lus. '
                  '${messageErreur(e)}',
              onRetry: () => ref.invalidate(
                representantCommentsProvider(widget.representantId),
              ),
            ),
            data: (List<RepresentantComment> list) {
              if (list.isEmpty) {
                return Text(
                  'Aucun commentaire pour l\'instant.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  for (final RepresentantComment c in list)
                    Padding(
                      padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
                      child: CpiCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: <Widget>[
                            Text(c.body, style: theme.textTheme.bodyMedium),
                            const SizedBox(height: CpiSpacing.xxs),
                            Text(
                              '${c.authorName} · ${relativeTime(c.clientCreatedAt)}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      );
    },
  );
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
    final List<ProspectSyncViewData>? list = rows.value;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _Section(list == null ? 'Prospects' : 'Prospects (${list.length})'),
        rows.whenEchecDAbord(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: CpiSpacing.sm),
            child: FProgress(),
          ),
          error: (Object e, StackTrace _) => CpiErrorState(
            message:
                'Les prospects n\'ont pas pu être lus. ${messageErreur(e)}',
            onRetry: () => ref.invalidate(
              prospectsForRepresentantProvider(representantId),
            ),
          ),
          data: (List<ProspectSyncViewData> list) {
            if (list.isEmpty) {
              return Text(
                'Aucun prospect pour l\'instant.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              );
            }
            return CpiCard.rows(<CpiRow>[
              for (final ProspectSyncViewData p in list)
                _ligneProspect(context, p),
            ]);
          },
        ),
      ],
    );
  }
}

CpiRow _ligneProspect(BuildContext context, ProspectSyncViewData p) {
  final SyncStatus status = SyncStatus.parse(p.syncStatus ?? 'draft');
  final String? signal = status.aSignaler;
  return CpiRow(
    leading: signal == null
        ? null
        : SyncStatusIcon(status: status, size: CpiIconSize.md, labelled: false),
    title: '${p.prenom} ${p.nom}',
    subtitle: signal == null
        ? Phone.format(p.phoneE164)
        : '${Phone.format(p.phoneE164)} · $signal',
    onTap: () => context.pushOnce(Routes.prospectDetailFor(p.id)),
  );
}

class _Missing extends StatelessWidget {
  const _Missing();

  @override
  Widget build(BuildContext context) => CpiEmptyState(
    icon: PhosphorIconsDuotone.userMinus,
    title: 'Cette fiche n\'est plus ici',
    message: 'Elle a été supprimée sur cet appareil.',
    action: CpiButton(
      'Voir mes fiches',
      expand: false,
      onPressed: () => context.go(Routes.historique),
    ),
  );
}
