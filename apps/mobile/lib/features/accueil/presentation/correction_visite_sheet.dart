import 'dart:async';

import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/connectivity.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../data/repositories/visites_repository.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/error_state.dart';
import '../../auth/auth_state.dart';
import '../visites_repository.dart';
import 'visite_champs.dart';

/// Ouvre « Corriger la visite » et rend `true` si la correction a été acceptée.
Future<bool?> ouvrirCorrectionVisite(
  BuildContext context,
  VisiteAvecStatut visite,
) => showCpiSheet<bool>(
  context,
  title: 'Corriger la visite',
  builder: (BuildContext feuille) => CorrectionVisiteSheet(visite: visite),
);

/// La correction d'une ligne du registre, sur les mêmes champs que le
/// formulaire.
///
/// Deux chemins, et un seul refus :
///
/// * pas encore partie (`reference == null`) : l'opération de création est
///   retirée de la file et la visite réinscrite. Marche hors ligne ;
/// * déjà partie, en ligne : `PATCH /v1/visites/:id`, hors file, et la ligne
///   locale est recopiée dans la foulée. La date et la référence ne bougent
///   pas ;
/// * déjà partie, hors ligne : lecture seule. Le serveur seul peut trancher,
///   et une file de corrections rouvrirait la question de l'ordre entre elles.
class CorrectionVisiteSheet extends ConsumerStatefulWidget {
  const CorrectionVisiteSheet({super.key, required this.visite});

  final VisiteAvecStatut visite;

  @override
  ConsumerState<CorrectionVisiteSheet> createState() =>
      _CorrectionVisiteSheetState();
}

class _CorrectionVisiteSheetState extends ConsumerState<CorrectionVisiteSheet> {
  final VisiteSaisie _saisie = VisiteSaisie();

  bool _prerempli = false;
  bool _envoiEnCours = false;
  String? _echec;

  @override
  void dispose() {
    _saisie.dispose();
    super.dispose();
  }

  /// Un identifiant que le référentiel du jour ne connaît plus est MORT : le
  /// garder ferait repartir la visite avec l'entrée que le serveur vient de
  /// refuser. Le champ se vide, et l'accueil rechoisit.
  void _preremplir(VisiteReferentielsBundleDto bundle) {
    final VisiteAvecStatut v = widget.visite;
    _prerempli = true;
    _saisie.nom.text = v.visitorName;
    _saisie.telephone.text = Phone.editable(v.phone ?? '');
    _saisie.lireCommentaire(v.comment);

    final String? entreprise = labelReferentiel(
      bundle.entreprises,
      v.entrepriseId,
    );
    _saisie.entrepriseId = entreprise == null ? null : v.entrepriseId;
    _saisie.entreprise.text = entreprise ?? '';

    final String? objet = labelReferentiel(bundle.objets, v.objetId);
    _saisie.objetId = objet == null ? null : v.objetId;
    _saisie.objet.text = objet ?? '';

    final String? direction = labelReferentiel(
      bundle.directions,
      v.directionId,
    );
    _saisie.directionId = direction == null ? null : v.directionId;
    _saisie.direction.text = direction ?? '';

    final String? destinataire = labelReferentiel(
      bundle.destinataires,
      v.destinataireId,
    );
    _saisie.destinataireId = destinataire == null ? null : v.destinataireId;
    _saisie.destinataire.text = destinataire == null
        ? ''
        : titreEtRole(destinataire).$1;
  }

  Future<void> _enregistrer(VisiteReferentielsBundleDto bundle) async {
    if (_envoiEnCours) return;
    final bool complet = _saisie.valider();
    setState(() {});
    if (!complet) return;

    final VisiteAvecStatut v = widget.visite;
    final String nom = _saisie.nom.text.trim();
    // Écrit tel qu'il est lu, indicatif du décor compris.
    final String telephone = Phone.displayed(_saisie.telephone.text);
    final String? phone = telephone.isEmpty ? null : telephone;
    final String? comment = _saisie.commentaire;
    final String entrepriseId = _saisie.entrepriseId!;
    final String objetId = _saisie.objetId!;
    final String? directionId = _saisie.directionId;
    final String? destinataireId = _saisie.destinataireId;
    final String entrepriseLabel = labelReferentiel(
      bundle.entreprises,
      entrepriseId,
    )!;
    final String objetLabel = labelReferentiel(bundle.objets, objetId)!;
    final String? directionLabel = labelReferentiel(
      bundle.directions,
      directionId,
    );
    final String? destinataireLabel = labelReferentiel(
      bundle.destinataires,
      destinataireId,
    );

    setState(() {
      _envoiEnCours = true;
      _echec = null;
    });
    try {
      if (v.reference == null) {
        final AuthState auth = ref.read(authControllerProvider);
        await ref
            .read(writeRepositoryProvider)
            .corrigerVisiteEnFile(
              visiteId: v.id,
              visitorName: nom,
              date: v.date,
              time: v.time,
              phone: phone,
              entrepriseId: entrepriseId,
              entrepriseLabel: entrepriseLabel,
              objetId: objetId,
              objetLabel: objetLabel,
              directionId: directionId,
              directionLabel: directionLabel,
              destinataireId: destinataireId,
              destinataireLabel: destinataireLabel,
              comment: comment,
              createdById: auth.userId ?? '',
            );
        ref.read(syncCoordinatorProvider.notifier).nudge();
      } else {
        await ref
            .read(apiPortProvider)
            .updateVisite(
              id: v.id,
              visitorName: nom,
              entrepriseId: entrepriseId,
              objetId: objetId,
              phone: phone,
              directionId: directionId,
              destinataireId: destinataireId,
              comment: comment,
            );
        await ref
            .read(writeRepositoryProvider)
            .appliquerCorrectionVisite(
              visiteId: v.id,
              visitorName: nom,
              phone: phone,
              entrepriseId: entrepriseId,
              entrepriseLabel: entrepriseLabel,
              objetId: objetId,
              objetLabel: objetLabel,
              directionId: directionId,
              directionLabel: directionLabel,
              destinataireId: destinataireId,
              destinataireLabel: destinataireLabel,
              comment: comment,
            );
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _echec = 'La correction n\'est pas passée. ${messageErreur(error)}';
      });
    } finally {
      if (mounted) setState(() => _envoiEnCours = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final VisiteAvecStatut v = widget.visite;
    final VisiteReferentielsBundleDto? bundle = ref
        .watch(visiteReferentielsProvider)
        .value;
    final bool horsLigne =
        ref.watch(connectivityProvider) != CpiConnectivity.online;
    final bool lectureSeule = v.reference != null && horsLigne;

    if (bundle != null && !_prerempli) _preremplir(bundle);

    final String? echec = _echec;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        CpiStatusBand(
          text: _etat(v, lectureSeule: lectureSeule),
          tone: lectureSeule ? CpiTone.warning : CpiTone.neutral,
        ),
        if (lectureSeule)
          _Resume(visite: v)
        else if (bundle == null)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: CpiSpacing.lg),
            child: Center(child: FCircularProgress()),
          )
        else
          ChampsVisite(
            saisie: _saisie,
            bundle: bundle,
            frequents:
                ref.watch(topLabelsVisitesProvider).value ?? TopLabels.vide,
            // Les trois étapes d'un coup : on vient ici relire une visite
            // entière, pas la ressaisir.
            onModifie: () {},
          ),
        const SizedBox(height: CpiSpacing.md),
        if (echec != null) ...<Widget>[
          CpiStatusBand(
            text: echec,
            tone: CpiTone.danger,
            actionLabel: 'Réessayer',
            onAction: bundle == null
                ? null
                : () => unawaited(_enregistrer(bundle)),
          ),
          const SizedBox(height: CpiSpacing.xs),
        ],
        if (!lectureSeule)
          CpiButton(
            _envoiEnCours ? 'Correction…' : 'Enregistrer la correction',
            key: const ValueKey<String>('correction-enregistrer'),
            loading: _envoiEnCours,
            onPressed: bundle == null || _envoiEnCours
                ? null
                : () => unawaited(_enregistrer(bundle)),
          ),
        const SizedBox(height: CpiSpacing.xs),
        CpiButton(
          lectureSeule ? 'Fermer' : 'Annuler',
          variant: CpiButtonVariant.ghost,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }

  static String _etat(VisiteAvecStatut v, {required bool lectureSeule}) {
    if (v.reference == null) {
      return 'Pas encore envoyée. Vous pouvez tout changer.';
    }
    if (lectureSeule) {
      return 'Cette visite est déjà envoyée. Il faut du réseau pour la '
          'corriger.';
    }
    final String jour = _jourCourt(v.date);
    final String? heure = v.time;
    return heure == null
        ? 'Déjà envoyée le $jour. La date ne change pas.'
        : 'Déjà envoyée le $jour à $heure. La date ne change pas.';
  }

  /// « 2026-08-27 » → « 27/08 ». Aucune donnée de locale n'est nécessaire pour
  /// deux nombres, et la feuille s'ouvre avant que `fr` ne soit chargé.
  static String _jourCourt(String date) {
    final List<String> parts = date.split('-');
    if (parts.length != 3) return date;
    return '${parts[2]}/${parts[1]}';
  }
}

/// La visite telle qu'elle est partie, quand le réseau manque pour la changer.
class _Resume extends StatelessWidget {
  const _Resume({required this.visite});

  final VisiteAvecStatut visite;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final List<(String, String)> lignes = <(String, String)>[
      ('Nom du visiteur', visite.visitorName),
      ('Société visitée', visite.entrepriseLabel),
      if (visite.destinataireLabel != null)
        ('Vient voir', visite.destinataireLabel!),
      if (visite.directionLabel != null)
        ('Étage ou service', visite.directionLabel!),
      ('Objet de la visite', visite.objetLabel),
      if (visite.phone != null) ('Téléphone', visite.phone!),
      if (visite.comment != null) ('Note', visite.comment!),
      if (visite.reference != null) ('N° de registre', visite.reference!),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        for (final (String titre, String valeur) in lignes)
          Padding(
            padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  titre,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                Text(valeur, style: theme.textTheme.bodyMedium),
              ],
            ),
          ),
      ],
    );
  }
}
