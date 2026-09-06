import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/network/api_environment.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/telephonie/appels_crm.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../core/utils/whatsapp.dart';
import '../../../data/local/database.dart';
import '../../../ui/async_value_x.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../../../ui/widgets/sync_status_icon.dart';
import '../../auth/auth_state.dart';
import '../../phase2/phase2_controller.dart';
import '../../shell/projects.dart';
import '../../telephonie/appels_a_consigner.dart';
import '../situation_labels.dart';

/// La fiche d'un prospect, en LECTURE, pour préparer et consigner un appel.
///
/// Rien ne s'y modifie ni ne s'y supprime : la base vient du bureau. Ce que le
/// téléconseiller a besoin de voir avant de composer, c'est le numéro, qui l'a
/// présenté, et ce que le dernier appel a donné.
///
/// Elle vit hors des coques : la palette vient du projet du prospect, pas de
/// l'écran d'où l'on arrive.
class ProspectDetailScreen extends ConsumerWidget {
  const ProspectDetailScreen({super.key, required this.prospectId});

  final String prospectId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<ProspectSyncViewData?> fiche = ref.watch(
      prospectDetailProvider(prospectId),
    );
    final ProspectSyncViewData? data = fiche.value;
    // Le projet n'est connu qu'après la lecture locale : tant qu'elle n'a rien
    // rendu, la fiche garde la palette CPI du hub plutôt que d'inventer celle
    // d'un projet qu'elle ignore encore.
    final bool chues = data?.projet == 'CHUES';
    final String retour = chues ? Routes.historique : Routes.grandPublicFiches;
    final String nom = data == null
        ? 'Fiche'
        : '${data.prenom} ${data.nom}'.trim();

    return ProjectScope(
      project: chues ? CpiProject.chues : CpiProject.grandPublic,
      child: CpiPopScope(
        fallback: retour,
        child: CpiScaffold(
          title: nom,
          leading: CpiBackButton(fallback: retour),
          footer: data == null ? null : _Pied(data: data, chues: chues),
          body: fiche.whenEchecDAbord(
            loading: () => const Center(child: FCircularProgress()),
            error: (Object e, StackTrace _) => CpiErrorState(
              message: 'Cette fiche n\'a pas pu être lue. ${messageErreur(e)}',
              onRetry: () => ref.invalidate(prospectDetailProvider(prospectId)),
            ),
            data: (ProspectSyncViewData? data) {
              if (data == null) return const _Introuvable();
              return _Fiche(data: data);
            },
          ),
        ),
      ),
    );
  }
}

class _Pied extends ConsumerWidget {
  const _Pied({required this.data, required this.chues});

  final ProspectSyncViewData data;
  final bool chues;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String? numeroWhatsapp = _numeroWhatsapp(data);
    return CpiActionBar(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          CpiButton(
            'Appeler',
            icon: PhosphorIconsRegular.phoneCall,
            onPressed: () => unawaited(
              ref
                  .read(appelsCrmProvider.notifier)
                  .lancer(
                    context,
                    kind: 'prospect',
                    id: data.id,
                    e164: data.phoneE164,
                  ),
            ),
          ),
          const SizedBox(height: CpiSpacing.xs),
          CpiButton(
            'Consigner l\'appel',
            variant: CpiButtonVariant.secondary,
            icon: PhosphorIconsRegular.notePencil,
            onPressed: () => context.pushOnce(
              Uri(
                path: chues ? Routes.phase2 : '/grand-public/phase2',
                queryParameters: <String, String>{
                  Routes.prefillPhoneParam: data.phoneE164,
                },
              ).toString(),
            ),
          ),
          const SizedBox(height: CpiSpacing.xs),
          // EB-26. Éteint tant qu'aucun numéro WhatsApp n'est connu : le
          // téléphone principal n'en est pas un tant que personne ne l'a dit.
          CpiButton(
            'Écrire sur WhatsApp',
            variant: CpiButtonVariant.ghost,
            icon: PhosphorIconsRegular.whatsappLogo,
            onPressed: numeroWhatsapp == null
                ? null
                : () => unawaited(
                    ecrireSurWhatsapp(
                      context,
                      numeroWhatsapp,
                      _messageWhatsapp(ref, data),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  static String? _numeroWhatsapp(ProspectSyncViewData data) =>
      switch (WhatsappStatus.parse(data.whatsappStatus)) {
        WhatsappStatus.memeNumero => data.phoneE164,
        WhatsappStatus.autreNumero => data.whatsappE164,
        _ => null,
      };

  /// Le gabarit `messageWhatsapp` (EB-29) rendu pour ce prospect, ou nul tant
  /// que les paramètres n'ont pas répondu — le bouton part alors sans texte
  /// plutôt que d'attendre.
  static String? _messageWhatsapp(WidgetRef ref, ProspectSyncViewData data) {
    final String? gabarit = ref
        .watch(parametresChuesProvider)
        .value
        ?.messageWhatsapp;
    if (gabarit == null) return null;
    final AuthState moi = ref.watch(authControllerProvider);
    return rendreMessageWhatsapp(gabarit, <String, String>{
      'prenom': data.prenom,
      'lien': moi.userId == null
          ? ''
          : '${ApiEnvironment.baseUrl}/demande/${moi.userId}',
      'teleconseiller': moi.fullName ?? '',
      'telephoneTeleconseiller': moi.phoneE164 ?? '',
    });
  }
}

class _Fiche extends ConsumerWidget {
  const _Fiche({required this.data});

  final ProspectSyncViewData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final SyncStatus status = SyncStatus.parse(data.syncStatus ?? 'draft');
    final ProspectCallState? appel = ref
        .watch(prospectCallStateProvider(data.id))
        .value;

    final String? representantId = data.representantId;
    final RepresentantSyncViewData? representant = representantId == null
        ? null
        : ref.watch(representantDetailProvider(representantId)).value;

    final String? statut = appel?.status;
    final String? methode = appel?.method;
    final DateTime? rappel = appel?.callbackAt;

    final List<CpiRow> faits = <CpiRow>[
      ?ligneAppelNonConsigne(context, ref, kind: 'prospect', entityId: data.id),
      if (representantId != null)
        CpiRow(
          leading: const Icon(
            PhosphorIconsRegular.userCircle,
            size: CpiIconSize.md,
          ),
          title: 'Représentant',
          subtitle: representant?.fullName ?? 'Fiche non téléchargée',
          onTap: representant == null
              ? null
              : () => context.pushOnce(
                  Routes.representantDetailFor(representantId),
                ),
        ),
      if (statut != null)
        CpiRow(
          leading: const Icon(
            PhosphorIconsRegular.phoneCall,
            size: CpiIconSize.md,
          ),
          title: 'Dernier appel',
          subtitle: Phase2Controller.labelForStatus(statut),
        ),
      if (methode != null)
        CpiRow(
          leading: const Icon(
            PhosphorIconsRegular.handshake,
            size: CpiIconSize.md,
          ),
          title: 'Méthode d\'enrôlement',
          subtitle: Phase2Controller.labelForMethod(methode),
        ),
      if (rappel != null)
        CpiRow(
          leading: const Icon(
            PhosphorIconsRegular.bellRinging,
            size: CpiIconSize.md,
          ),
          title: 'Rappel promis',
          // Dakar est à UTC toute l'année : l'heure saisie et l'heure lue
          // coïncident.
          subtitle:
              '${MaterialLocalizations.of(context).formatMediumDate(rappel.toUtc())} à '
              '${MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(rappel.toUtc()))}',
        ),
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        0,
        CpiSpacing.md,
        CpiSpacing.xxl,
      ),
      children: <Widget>[
        if (status.aSignaler != null) ...<Widget>[
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: SyncStatusChip(status: status),
          ),
          const SizedBox(height: CpiSpacing.md),
        ],
        _Numero(prospectId: data.id, phoneE164: data.phoneE164),
        if (faits.isNotEmpty) ...<Widget>[
          const SizedBox(height: CpiSpacing.md),
          CpiCard.rows(faits),
        ],
        _Situation(data: data),
      ],
    );
  }
}

/// Ce que la situation du prospect a fait renseigner. Un champ vide ne se dit
/// pas : la fiche montre ce qu'on sait, pas la liste des questions.
class _Situation extends ConsumerWidget {
  const _Situation({required this.data});

  final ProspectSyncViewData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String? employeur =
        data.employeur ??
        _libelleDe(
          data.employeurId,
          ref.watch(employeursProvider).value,
          (Employeur e) => (e.id, e.label),
        );
    final String? profession =
        _libelleDe(
          data.professionId,
          ref.watch(professionsProvider).value,
          (Profession p) => (p.id, p.label),
        ) ??
        data.profession;
    final String? pays = _libelleDe(
      data.paysResidenceId,
      ref.watch(paysProvider).value,
      (PaysRow p) => (p.id, p.label),
    );
    final String? tranche = _libelleDe(
      data.incomeBandId,
      ref.watch(incomeBandsProvider).value,
      (IncomeBand b) => (b.id, b.label),
    );
    final String? canal = _libelleDe(
      data.canalProvenanceId,
      ref.watch(canauxProvenanceProvider).value,
      (CanauxProvenanceData c) => (c.id, c.label),
    );

    final List<CpiRow> lignes = <CpiRow?>[
      _ligne('Situation', kSituationLabels[data.type ?? '']),
      _ligne(
        data.type == 'FONCTIONNAIRE' ? 'Ministère ou structure' : 'Employeur',
        employeur,
      ),
      _ligne('Type de contrat', kTypeContratLabels[data.typeContrat ?? '']),
      _ligne(
        'Ancienneté',
        data.ancienneteMois == null ? null : '${data.ancienneteMois} mois',
      ),
      _ligne(data.type == 'INFORMEL' ? 'Activité' : 'Profession', profession),
      _ligne('Lieu d\'activité', data.lieuActivite),
      _ligne('Mode d\'épargne', kModeEpargneLabels[data.modeEpargne ?? '']),
      _ligne('Pays de résidence', pays),
      _ligne('Ville', data.villeResidence),
      _ligne('WhatsApp', _whatsapp(data)),
      _ligne('Établissement', data.etablissement),
      _ligne('Personne relais', data.relaisNom),
      _ligne('Téléphone du relais', data.relaisPhoneE164),
      _ligne('Tranche de revenus', tranche),
      _ligne(
        'Durée de remboursement',
        data.dureeSystemeMois == null ? null : '${data.dureeSystemeMois} mois',
      ),
      _ligne('Canal de provenance', canal),
    ].nonNulls.toList(growable: false);

    if (lignes.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: CpiSpacing.md),
      child: CpiCard.rows(lignes),
    );
  }

  /// Un numéro sur `AUTRE_NUMERO`, la réponse sinon. Une fiche de la diaspora
  /// d'avant EB-23 porte son numéro sans statut : il reste lisible.
  static String? _whatsapp(ProspectSyncViewData data) =>
      switch (WhatsappStatus.parse(data.whatsappStatus)) {
        WhatsappStatus.memeNumero => 'Même numéro',
        WhatsappStatus.aucun => 'Pas de WhatsApp',
        _ => data.whatsappE164,
      };

  static CpiRow? _ligne(String titre, String? valeur) =>
      valeur == null || valeur.trim().isEmpty
      ? null
      : CpiRow(title: titre, subtitle: valeur.trim());

  /// Le libellé du référentiel local, `null` tant qu'il n'est pas descendu :
  /// afficher l'identifiant brut ne dirait rien à personne.
  static String? _libelleDe<T>(
    String? id,
    List<T>? rows,
    (String, String) Function(T) champs,
  ) {
    if (id == null || rows == null) return null;
    for (final T row in rows) {
      final (String rowId, String label) = champs(row);
      if (rowId == id) return label;
    }
    return null;
  }
}

/// Le numéro en grand, et le geste qui le met dans le presse-papier. Le bouton
/// « Appeler » est en pied : ici on lit, on dicte, on recopie.
class _Numero extends ConsumerWidget {
  const _Numero({required this.prospectId, required this.phoneE164});

  final String prospectId;
  final String phoneE164;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final String affiche = Phone.format(phoneE164);
    final PreuvesAppelData? preuve = ref
        .watch(dernierePreuveProvider((kind: 'prospect', id: prospectId)))
        .value;
    final String? confirmation = preuve?.libelle;
    return Semantics(
      button: true,
      label: 'Téléphone $affiche. ${confirmation ?? ''} Toucher pour copier.',
      onTap: () => unawaited(_copier(context)),
      child: ExcludeSemantics(
        child: CpiCard(
          onTap: () => unawaited(_copier(context)),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      'Téléphone',
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: CpiSpacing.xxs),
                    Text(affiche, style: theme.textTheme.titleMedium),
                    if (confirmation != null) ...<Widget>[
                      const SizedBox(height: CpiSpacing.xxs),
                      Text(
                        confirmation,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: CpiSpacing.xs),
              Icon(
                PhosphorIconsRegular.copy,
                size: CpiIconSize.xl,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _copier(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: phoneE164));
    await HapticFeedback.selectionClick();
    if (!context.mounted) return;
    cpiToast(context, 'Numéro copié');
  }
}

class _Introuvable extends StatelessWidget {
  const _Introuvable();

  @override
  Widget build(BuildContext context) => CpiEmptyState(
    icon: PhosphorIconsDuotone.userMinus,
    title: 'Cette fiche n\'est plus ici',
    message: 'Elle a été supprimée sur cet appareil.',
    action: CpiButton(
      'Revenir aux projets',
      expand: false,
      onPressed: () => context.go(Routes.home),
    ),
  );
}
