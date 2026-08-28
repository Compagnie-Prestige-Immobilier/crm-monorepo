import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/connectivity.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/sync/api_port.dart';
import '../../../core/sync/outbox_status.dart';
import '../../../core/sync/phase2_directory_sync.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/local/database.dart';
import '../../../data/repositories/write_repository.dart';
import '../../../data/repositories/visites_repository.dart';
import '../../accueil/presentation/correction_visite_sheet.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../shell/app_shell.dart';
import '../../shell/projects.dart';
import 'discard_confirmation.dart';
import 'ownership_sheet.dart';
import '../../../ui/async_value_x.dart';

class CorrectionsScreen extends ConsumerWidget {
  const CorrectionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<OutboxData>> rows = ref.watch(needsAttentionProvider);
    final bool horsLigne =
        ref.watch(connectivityProvider) != CpiConnectivity.online;
    final int bloquees = rows.value?.length ?? 0;

    return CpiScaffold(
      title: 'À corriger',
      banner: _band(context, ref, horsLigne: horsLigne),
      footer: bloquees == 0
          ? null
          : CpiActionBar(
              child: CpiButton(
                'Réessayer d\'envoyer',
                icon: PhosphorIconsRegular.arrowClockwise,
                subtitle: 'Il faut du réseau',
                onPressed: horsLigne
                    ? null
                    : () => unawaited(
                        ref
                            .read(syncCoordinatorProvider.notifier)
                            .run(pull: false),
                      ),
              ),
            ),
      body: _body(context, ref, rows),
    );
  }

  /// Une seule bande d'état : le réseau d'abord, sinon la raison du dernier
  /// échec, avec le geste qui la rattrape.
  Widget? _band(
    BuildContext context,
    WidgetRef ref, {
    required bool horsLigne,
  }) {
    if (horsLigne) {
      return const CpiStatusBand(
        text: 'Hors ligne. Rien ne peut partir maintenant.',
        tone: CpiTone.warning,
      );
    }
    final String? label = ref.watch(syncCoordinatorProvider).failureLabel;
    if (label == null) return null;
    return CpiStatusBand(
      text: label,
      tone: CpiTone.danger,
      actionLabel: 'Réessayer',
      onAction: () => unawaited(
        ref.read(syncCoordinatorProvider.notifier).run(pull: false),
      ),
    );
  }

  Widget _body(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<List<OutboxData>> rows,
  ) {
    return rows.whenEchecDAbord(
      loading: () => const Center(child: FCircularProgress()),
      error: (Object e, StackTrace _) => _Illisible(error: e),
      data: (List<OutboxData> list) {
        if (list.isEmpty) return const _Empty();
        return RefreshIndicator(
          onRefresh: () async {
            final SyncCoordinator sync = ref.read(
              syncCoordinatorProvider.notifier,
            );
            await HapticFeedback.selectionClick();
            await sync.run(pull: false);
          },
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(
              CpiSpacing.md,
              CpiSpacing.sm,
              CpiSpacing.md,
              CpiSpacing.md,
            ),
            physics: const AlwaysScrollableScrollPhysics(),
            itemCount: list.length + 1,
            separatorBuilder: (BuildContext context, int index) =>
                const SizedBox(height: CpiSpacing.sm),
            itemBuilder: (BuildContext context, int index) {
              if (index == 0) return _Compte(nombre: list.length);
              return CpiListEntrance(
                index: index - 1,
                child: _CorrectionCard(row: list[index - 1]),
              );
            },
          ),
        );
      },
    );
  }
}

class _Compte extends StatelessWidget {
  const _Compte({required this.nombre});

  final int nombre;

  @override
  Widget build(BuildContext context) => Text(
    '$nombre saisie${nombre > 1 ? 's' : ''} bloquée${nombre > 1 ? 's' : ''}',
    style: Theme.of(context).textTheme.titleMedium,
  );
}

/// La file elle-même est illisible : le diagnostic ne sert à rien sans le geste
/// qui le rattrape, ni sans de quoi le transmettre au support.
class _Illisible extends ConsumerWidget {
  const _Illisible({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context, WidgetRef ref) => SingleChildScrollView(
    padding: const EdgeInsets.symmetric(vertical: CpiSpacing.lg),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        CpiErrorState(
          message: 'La liste des envois n\'a pas pu être lue.',
          onRetry: () => ref.invalidate(needsAttentionProvider),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: CpiSpacing.md),
          child: CpiButton(
            'Copier pour le support',
            variant: CpiButtonVariant.ghost,
            icon: PhosphorIconsRegular.copy,
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: '$error'));
              if (context.mounted) cpiToast(context, 'Copié.');
            },
          ),
        ),
      ],
    ),
  );
}

class _CorrectionCard extends ConsumerStatefulWidget {
  const _CorrectionCard({required this.row});

  final OutboxData row;

  @override
  ConsumerState<_CorrectionCard> createState() => _CorrectionCardState();
}

class _CorrectionCardState extends ConsumerState<_CorrectionCard> {
  bool _busy = false;

  /// L'arbitrage a été demandé sans réseau : la carte le garde écrit jusqu'au
  /// retour de la connexion, un message fugitif ne survivait pas au défilement.
  bool _besoinDInternet = false;

  OutboxData get row => widget.row;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final bool isConflict = row.status == OutboxStatus.conflict;
    final bool horsLigne =
        ref.watch(connectivityProvider) != CpiConnectivity.online;
    final bool bloqueParLeReseau =
        _besoinDInternet && horsLigne && _isOwnershipConflict;

    return CpiCard(
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
                size: CpiIconSize.md,
                color: isConflict ? cpi.syncConflict : cpi.syncFailed,
              ),
              const SizedBox(width: CpiSpacing.xs),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(_title, style: theme.textTheme.titleMedium),
                    const SizedBox(height: CpiSpacing.xxs),
                    Text(
                      _message,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    if (row.attempts > 0 ||
                        row.lastErrorCode != null) ...<Widget>[
                      const SizedBox(height: CpiSpacing.xs),
                      CpiTag(
                        _tag,
                        tone: isConflict ? CpiTone.warning : CpiTone.danger,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (bloqueParLeReseau) ...<Widget>[
            const SizedBox(height: CpiSpacing.sm),
            Semantics(
              liveRegion: true,
              child: const FAlert(
                icon: Icon(PhosphorIconsRegular.wifiSlash),
                title: Text(
                  'Cette saisie a besoin d\'Internet pour être débloquée.',
                ),
              ),
            ),
          ],
          const SizedBox(height: CpiSpacing.sm),
          if (_isOwnershipConflict)
            CpiButton(
              'Choisir',
              variant: CpiButtonVariant.secondary,
              icon: PhosphorIconsRegular.userSwitch,
              loading: _busy,
              subtitle: 'Il faut du réseau',
              onPressed: horsLigne && _besoinDInternet
                  ? null
                  : () => unawaited(_openOwnership()),
            )
          else if (_listePerimee)
            // Réessayer relancerait le même identifiant mort : ce qu'il faut,
            // c'est rechoisir dans la liste que le serveur sert aujourd'hui.
            CpiButton(
              'Modifier',
              variant: CpiButtonVariant.secondary,
              icon: PhosphorIconsRegular.pencilSimple,
              loading: _busy,
              onPressed: () => unawaited(_corrigerVisite()),
            )
          else
            CpiButton(
              'Réessayer',
              variant: CpiButtonVariant.secondary,
              icon: PhosphorIconsRegular.arrowClockwise,
              loading: _busy,
              onPressed: () => unawaited(_retry()),
            ),
          const SizedBox(height: CpiSpacing.xs),
          CpiButton(
            'Autres',
            variant: CpiButtonVariant.ghost,
            icon: PhosphorIconsRegular.dotsThreeCircle,
            onPressed: _busy ? null : () => unawaited(_openAutres()),
          ),
        ],
      ),
    );
  }

  /// L'entrée choisie dans une liste de l'accueil n'existe plus : réessayer
  /// avec le même identifiant ne peut rien donner, il faut rechoisir.
  bool get _listePerimee =>
      row.lastErrorCode == ServerErrorCodes.visiteReferentielUnavailable;

  bool get _isOwnershipConflict =>
      row.lastErrorCode == ServerErrorCodes.representantPhoneConflict ||
      row.lastErrorCode == ServerErrorCodes.representantOwnedByAnotherUser ||
      row.lastErrorCode == ServerErrorCodes.entityIdOwnedByAnotherUser;

  String get _title {
    final String what = switch (row.entityType) {
      'representant' => 'Représentant',
      'representant_comment' => 'Commentaire',
      callAttemptEntity => 'Appel',
      'visite' => 'Visite',
      _ => 'Prospect',
    };
    final String verb = switch (row.op) {
      'create' => 'création',
      'update' => 'modification',
      _ => 'suppression',
    };
    return _name.isEmpty ? '$what · $verb' : '$what · $_name';
  }

  String get _name {
    final Object? decoded = _payload;
    if (decoded is! Map) return '';
    return (decoded['fullName'] as String? ??
            decoded['visitorName'] as String? ??
            <String?>[
              decoded['prenom'] as String?,
              decoded['nom'] as String?,
            ].whereType<String>().join(' '))
        .trim();
  }

  Object? get _payload {
    try {
      return jsonDecode(row.payload);
    } on FormatException {
      return null;
    }
  }

  String get _tag {
    final String essais = row.attempts > 0
        ? '${row.attempts} tentative${row.attempts > 1 ? 's' : ''}'
        : '';
    final String code = row.lastErrorCode ?? '';
    return <String>[essais, code].where((String s) => s.isNotEmpty).join(' · ');
  }

  /// Le code brut reste dans la pastille : ici, la phrase que tout le monde
  /// comprend. La phrase française d'un code connu passe AVANT celle du
  /// serveur, qui est rédigée pour un journal et non pour le terrain.
  String get _message => _listePerimee
      ? 'Cette entrée n\'existe plus dans les listes de l\'accueil. '
            'Touchez « Modifier » pour en choisir une autre.'
      : ServerErrorCodes.phase2FieldErrors[row.lastErrorCode] ??
            row.lastErrorMsg ??
            (row.lastErrorCode == null
                ? 'Envoi impossible.'
                : 'Le serveur a refusé cette saisie.');

  Future<void> _retry() async {
    setState(() => _busy = true);
    try {
      await ref.read(writeRepositoryProvider).retryOperation(row.seq);
      await ref.read(syncCoordinatorProvider.notifier).run(pull: false);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openAutres() async {
    final bool modifiable =
        row.entityType == 'representant' || row.entityType == 'visite';
    await showCpiSheet<void>(
      context,
      title: 'Autres actions',
      builder: (BuildContext sheet) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          CpiButton(
            modifiable ? 'Modifier' : 'Voir la fiche',
            variant: CpiButtonVariant.secondary,
            icon: modifiable
                ? PhosphorIconsRegular.pencilSimple
                : PhosphorIconsRegular.identificationCard,
            onPressed: () {
              Navigator.of(sheet).pop();
              if (row.entityType == 'visite') {
                unawaited(_corrigerVisite());
                return;
              }
              _edit();
            },
          ),
          const SizedBox(height: CpiSpacing.xs),
          CpiButton(
            'Supprimer cette saisie',
            variant: CpiButtonVariant.danger,
            icon: PhosphorIconsRegular.trash,
            onPressed: () {
              Navigator.of(sheet).pop();
              unawaited(_discard());
            },
          ),
        ],
      ),
    );
  }

  Future<void> _openOwnership() async {
    final Object? decoded = _payload;
    final String? phone = decoded is Map ? decoded['phone'] as String? : null;
    if (phone == null) return;

    // Hors ligne, la recherche attend le délai de connexion puis deux essais :
    // trois quarts de minute sans rien à l'écran.
    if (ref.read(connectivityProvider) != CpiConnectivity.online) {
      setState(() => _besoinDInternet = true);
      return;
    }

    setState(() {
      _busy = true;
      _besoinDInternet = false;
    });
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
    cpiToast(context, message);
  }

  /// Ouvre la correction de la visite refusée : la feuille relit les listes du
  /// jour et vide l'entrée que le serveur ne connaît plus, pour qu'elle soit
  /// rechoisie. Enregistrer retire l'opération refusée et en dépose une neuve.
  Future<void> _corrigerVisite() async {
    setState(() => _busy = true);
    final VisiteAvecStatut? visite = await ref
        .read(visitesRepositoryProvider)
        .parId(row.entityId);
    if (!mounted) return;
    setState(() => _busy = false);
    if (visite == null) {
      _say('Cette visite n\'est plus sur ce téléphone.');
      return;
    }
    final bool? corrigee = await ouvrirCorrectionVisite(context, visite);
    if (corrigee == true) _say('Visite corrigée.');
  }

  void _edit() {
    if (row.entityType == 'representant') {
      context.pushOnce(
        '${Routes.newRepresentant}?id=${Uri.encodeComponent(row.entityId)}',
      );
      return;
    }
    // La fiche du prospect s'ouvre directement : c'est ce que « Voir la fiche »
    // promet. Une suppression refusée n'a plus de fiche à montrer, elle repasse
    // par la liste filtrée.
    if (row.entityType == 'prospect' && row.op != 'delete') {
      context.pushOnce(Routes.prospectDetailFor(row.entityId));
      return;
    }
    // Sans ce filtre, « Voir la fiche » ouvrait une liste de plusieurs centaines
    // de lignes où la saisie refusée n'était plus retrouvable.
    final Object? decoded = _payload;
    final String cherche = _name.isNotEmpty
        ? _name
        : (decoded is Map ? decoded['phone'] as String? ?? '' : '');
    // La liste est celle de la coque où « À corriger » a été ouvert. En dur sur
    // `/historique`, une visite refusée depuis l'accueil déposait l'utilisateur
    // dans la coque CHUES, avec ses onglets et sa palette.
    final CpiProject projet = projetDeLaCoque(context);
    if (projet == CpiProject.accueil) {
      ref.read(registreSearchProvider.notifier).set(cherche);
    } else {
      ref.read(historiqueSearchProvider.notifier).set(cherche);
    }
    context.go(projet.fiches);
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
      result = await ref
          .read(writeRepositoryProvider)
          .discardOperation(row.seq);
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
  Widget build(BuildContext context) => CpiEmptyState(
    icon: PhosphorIconsDuotone.checkCircle,
    title: 'Rien à corriger',
    message: 'Tout est parti au serveur.',
    iconColor: context.cpi.success,
  );
}
