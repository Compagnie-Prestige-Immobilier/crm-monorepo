import 'dart:async';

import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/drafts/draft_form_mixin.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/providers/connectivity.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/ids.dart';
import '../../../core/utils/phone.dart';
import '../../../data/repositories/draft_repository.dart';
import '../../../data/repositories/visites_repository.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/cpi_steps.dart';
import '../../auth/auth_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../visites_repository.dart';
import 'visite_champs.dart';

class VisiteFormScreen extends ConsumerStatefulWidget {
  const VisiteFormScreen({super.key, this.draftId});

  final String? draftId;

  @override
  ConsumerState<VisiteFormScreen> createState() => _VisiteFormScreenState();
}

class _VisiteFormScreenState extends ConsumerState<VisiteFormScreen>
    with DraftFormMixin<VisiteFormScreen> {
  final VisiteSaisie _saisie = VisiteSaisie();

  late DateTime _saisiA = ref.read(clockProvider).now();
  late DateTime _moment = _saisiA;
  late final String _draftId = widget.draftId ?? Ids.newId();

  /// Trois écrans plutôt qu'un mur : huit champs d'affilée, l'accueil ne sait
  /// plus où il en est, et le premier visiteur pressé fait sauter la moitié.
  static const List<EtapeVisite> _etapes = EtapeVisite.values;
  int _etape = 0;

  bool _envoiEnCours = false;
  String? _echec;

  /// Une réception de listes a été demandée : sans ce témoin, l'écran ne peut
  /// pas dire « toujours rien reçu » plutôt que « pas encore là ».
  bool _listesDemandees = false;

  Timer? _rappelDebounce;
  VisiteAvecStatut? _rappel;
  bool _rappelRepris = false;

  @override
  String get draftId => _draftId;

  @override
  String get draftFormKey => 'visite.create';

  @override
  DraftRepository get draftRepository => ref.read(draftRepositoryProvider);

  @override
  bool get draftIsEmpty => _saisie.vide;

  @override
  int get draftStep => _etape;

  @override
  String? draftRouteWithId() => widget.draftId != null
      ? null
      : Routes.accueilVisiteNewWithDraft(_draftId);

  @override
  Map<String, Object?> collectDraftValues() => <String, Object?>{
    'nom': _saisie.nom.text,
    'telephone': _saisie.telephone.text,
    // « Venu de » et la note voyagent assemblés, comme en base : un brouillon
    // relu redonne les deux champs séparés.
    'commentaire': _saisie.commentaire,
    'moment': _moment.toIso8601String(),
    'entrepriseId': _saisie.entrepriseId,
    'objetId': _saisie.objetId,
    'directionId': _saisie.directionId,
    'destinataireId': _saisie.destinataireId,
  };

  @override
  void initState() {
    super.initState();
    for (final TextEditingController c in _saisie.champsLibres) {
      c.addListener(markDraftDirty);
    }
    _saisie.nom.addListener(_nomChange);
    unawaited(_restaurer());
  }

  /// Seul le brouillon d'un PLANTAGE est repris d'office. À l'accueil chaque
  /// visiteur est une saisie neuve : ressortir une saisie simplement
  /// interrompue remplirait le formulaire du visiteur précédent. Une ligne
  /// qui ne sera jamais montrée ne reste pas non plus en base sept jours avec
  /// un nom et un numéro de visiteur en clair.
  Future<void> _restaurer() async {
    final DraftSnapshot? snapshot = await draftRepository.read(_draftId);
    if (snapshot == null) return;
    if (snapshot.age != DraftAge.crash) {
      await draftRepository.delete(_draftId);
      return;
    }
    if (!mounted) return;
    setState(() {
      _saisie.nom.text = (snapshot.values['nom'] as String?) ?? '';
      _saisie.telephone.text = (snapshot.values['telephone'] as String?) ?? '';
      _saisie.lireCommentaire(snapshot.values['commentaire'] as String?);
      _moment =
          DateTime.tryParse((snapshot.values['moment'] as String?) ?? '') ??
          _moment;
      // Reprendre à l'étape où le plantage a coupé : recommencer par le nom
      // ferait retaper ce que le brouillon vient de rendre.
      _etape = snapshot.step.clamp(0, _etapes.length - 1);
      // Les listes ne sont pas encore là : on retient les identifiants et on
      // les résout contre le référentiel réel, plutôt que de refabriquer des
      // DTO à partir du brouillon.
      _aResoudre = snapshot.values;
    });
  }

  Map<String, Object?>? _aResoudre;

  void _resoudreChoix(VisiteReferentielsBundleDto bundle) {
    final Map<String, Object?> valeurs = _aResoudre!;
    _aResoudre = null;
    setState(() {
      _choisir(bundle, 'entreprise', valeurs['entrepriseId'] as String?);
      _choisir(bundle, 'objet', valeurs['objetId'] as String?);
      _choisir(bundle, 'direction', valeurs['directionId'] as String?);
      _choisir(bundle, 'destinataire', valeurs['destinataireId'] as String?);
    });
  }

  /// Pose un choix de liste à partir de son seul identifiant : l'intitulé
  /// affiché vient toujours du référentiel, jamais d'une copie conservée.
  void _choisir(VisiteReferentielsBundleDto bundle, String champ, String? id) {
    final (
      List<VisiteReferentielDto> liste,
      TextEditingController champTexte,
    ) = switch (champ) {
      'entreprise' => (bundle.entreprises, _saisie.entreprise),
      'objet' => (bundle.objets, _saisie.objet),
      'direction' => (bundle.directions, _saisie.direction),
      _ => (bundle.destinataires, _saisie.destinataire),
    };
    final String? label = labelReferentiel(liste, id);
    final String? retenu = label == null ? null : id;
    switch (champ) {
      case 'entreprise':
        _saisie.entrepriseId = retenu;
      case 'objet':
        _saisie.objetId = retenu;
      case 'direction':
        _saisie.directionId = retenu;
      default:
        _saisie.destinataireId = retenu;
    }
    // Le rôle du destinataire vit en sous-titre : le champ porte le titre seul.
    champTexte.text = label == null
        ? ''
        : (champ == 'destinataire' ? titreEtRole(label).$1 : label);
  }

  @override
  void dispose() {
    _rappelDebounce?.cancel();
    _saisie.nom.removeListener(_nomChange);
    for (final TextEditingController c in _saisie.champsLibres) {
      c.removeListener(markDraftDirty);
    }
    _saisie.dispose();
    super.dispose();
  }

  /// Le rappel visiteur suit la frappe, pas la base : trois lettres, un temps
  /// d'arrêt, une lecture locale.
  ///
  /// La frappe rouvre aussi « Continuer » : c'est le nom qui le tient fermé.
  void _nomChange() {
    if (mounted) setState(() {});
    _rappelDebounce?.cancel();
    final String nom = _saisie.nom.text.trim();
    if (nom.length < 3) {
      if (_rappel != null) setState(() => _rappel = null);
      return;
    }
    _rappelDebounce = Timer(
      const Duration(milliseconds: 350),
      () => unawaited(_chercherRappel(nom)),
    );
  }

  Future<void> _chercherRappel(String nom) async {
    final VisiteAvecStatut? trouvee = await ref
        .read(visitesRepositoryProvider)
        .dernierePourNom(nom, maintenant: ref.read(clockProvider).now());
    if (!mounted) return;
    setState(() {
      _rappel = trouvee;
      _rappelRepris = false;
    });
  }

  void _reprendre(VisiteAvecStatut visite, BuildContext toaster) {
    final VisiteReferentielsBundleDto? bundle = ref
        .read(visiteReferentielsProvider)
        .value;
    if (bundle == null) return;
    setState(() {
      _choisir(bundle, 'entreprise', visite.entrepriseId);
      _choisir(bundle, 'objet', visite.objetId);
      _choisir(bundle, 'direction', visite.directionId);
      _choisir(bundle, 'destinataire', visite.destinataireId);
      _saisie.telephone.text = Phone.editable(visite.phone ?? '');
      _saisie.erreurEntreprise = null;
      _saisie.erreurObjet = null;
      _rappelRepris = true;
    });
    markDraftDirty();
    cpiToast(
      toaster,
      'Repris de la visite du ${_jourEnLettres(visite.date)}. '
      'Vérifiez l\'objet.',
    );
  }

  Future<void> _changerHeure(BuildContext ancre) async {
    final DateTime utc = _moment.toUtc();
    final FTime? choisie = await showCpiSheet<FTime>(
      ancre,
      title: 'Heure de la visite',
      builder: (BuildContext feuille) =>
          _FeuilleHeure(initiale: FTime(utc.hour, utc.minute)),
    );
    if (choisie == null || !mounted) return;
    setState(() {
      _moment = DateTime.utc(
        utc.year,
        utc.month,
        utc.day,
        choisie.hour,
        choisie.minute,
      );
    });
    markDraftDirty();
  }

  void _reculerUnQuartDHeure() {
    setState(() => _moment = _moment.subtract(const Duration(minutes: 15)));
    markDraftDirty();
  }

  void _suivant() {
    FocusScope.of(context).unfocus();
    setState(() => _etape += 1);
    unawaited(flushDraft());
  }

  void _precedent() {
    FocusScope.of(context).unfocus();
    setState(() => _etape -= 1);
  }

  /// Quitter le formulaire, en prévenant si une saisie serait perdue.
  Future<void> _quitter() async {
    if (draftIsEmpty) {
      popOrHome(context, fallback: Routes.accueil);
      return;
    }
    final bool? partir = await cpiConfirm(
      context,
      title: 'Quitter sans enregistrer ?',
      message: 'Ce que vous avez écrit sera perdu.',
      confirmLabel: 'Quitter',
      danger: true,
    );
    if (partir != true || !mounted) return;
    popOrHome(context, fallback: Routes.accueil);
  }

  void _viderTout() {
    setState(() {
      for (final TextEditingController c in <TextEditingController>[
        _saisie.nom,
        _saisie.entreprise,
        _saisie.destinataire,
        _saisie.direction,
        _saisie.objet,
        _saisie.venuDe,
        _saisie.telephone,
        _saisie.note,
      ]) {
        c.clear();
      }
      _saisie.entrepriseId = null;
      _saisie.destinataireId = null;
      _saisie.directionId = null;
      _saisie.objetId = null;
      _saisie.erreurNom = null;
      _saisie.erreurEntreprise = null;
      _saisie.erreurObjet = null;
      _rappel = null;
      _echec = null;
      _etape = 0;
      _saisiA = ref.read(clockProvider).now();
      _moment = _saisiA;
    });
    discardDraft();
    unawaited(draftRepository.delete(_draftId));
    _saisie.nomFocus.requestFocus();
  }

  Future<void> _enregistrer(BuildContext toaster) async {
    if (_envoiEnCours) return;
    final VisiteReferentielsBundleDto? bundle = ref
        .read(visiteReferentielsProvider)
        .value;
    if (bundle == null) return;

    final bool complet = _saisie.valider();
    setState(() {});
    if (!complet) return;

    final String nom = _saisie.nom.text.trim();
    // Ce qui est ÉCRIT au registre est ce que l'accueil a lu : l'indicatif du
    // décor y revient, et rien n'est renormalisé (`visites.service.ts`).
    final String telephone = Phone.displayed(_saisie.telephone.text);
    final String? commentaire = _saisie.commentaire;
    final String entrepriseId = _saisie.entrepriseId!;
    final String objetId = _saisie.objetId!;
    final String? directionId = _saisie.directionId;
    final String? destinataireId = _saisie.destinataireId;

    setState(() {
      _envoiEnCours = true;
      _echec = null;
    });

    try {
      final AuthState auth = ref.read(authControllerProvider);
      await ref
          .read(writeRepositoryProvider)
          .inscrireVisite(
            visitorName: nom,
            date: jourDakar(_moment),
            time: heureDakar(_moment),
            phone: telephone.isEmpty ? null : telephone,
            entrepriseId: entrepriseId,
            entrepriseLabel: labelReferentiel(
              bundle.entreprises,
              entrepriseId,
            )!,
            objetId: objetId,
            objetLabel: labelReferentiel(bundle.objets, objetId)!,
            directionId: directionId,
            directionLabel: labelReferentiel(bundle.directions, directionId),
            destinataireId: destinataireId,
            destinataireLabel: labelReferentiel(
              bundle.destinataires,
              destinataireId,
            ),
            comment: commentaire,
            createdById: auth.userId ?? '',
          );
      // La visite est écrite et en file : le brouillon n'a plus rien à sauver,
      // et le laisser ferait revenir ce visiteur-ci sur la saisie du suivant.
      discardDraft();
      await draftRepository.delete(_draftId);
      unawaited(HapticFeedback.mediumImpact());
      if (!mounted) return;
      ref.read(syncCoordinatorProvider.notifier).nudge();

      // Ce qui repart vide, et ce qui reste pour le visiteur suivant : la
      // société visitée, la personne demandée et l'étage sont les mêmes toute
      // la journée, le reste appartient au visiteur qui vient d'entrer.
      _saisie.nom.clear();
      _saisie.objet.clear();
      _saisie.venuDe.clear();
      _saisie.telephone.clear();
      _saisie.note.clear();
      final CompteursAccueil compteurs = await ref
          .read(visitesRepositoryProvider)
          .watchCompteurs(ref.read(clockProvider).now())
          .first;
      if (!mounted) return;
      setState(() {
        _saisie.objetId = null;
        _rappel = null;
        // Retour à la première étape, avec ce qui vaut pour toute la journée.
        _etape = 0;
        _saisiA = ref.read(clockProvider).now();
        _moment = _saisiA;
      });
      _saisie.nomFocus.requestFocus();
      // Le compte rendu passe par un message : en tête de formulaire, il
      // poussait le premier champ hors de l'écran à chaque visiteur.
      if (toaster.mounted) {
        cpiToast(
          toaster,
          'Inscrit. ${compteurs.jour} '
          '${compteurs.jour > 1 ? 'visiteurs' : 'visiteur'} aujourd\'hui.',
        );
      }
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _echec = 'La visite n\'a pas été enregistrée. ${messageErreur(error)}';
      });
    } finally {
      if (mounted) setState(() => _envoiEnCours = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<VisiteReferentielsBundleDto> listes = ref.watch(
      visiteReferentielsProvider,
    );
    final VisiteReferentielsBundleDto? bundle = listes.value;
    if (bundle != null && _aResoudre != null) {
      WidgetsBinding.instance.addPostFrameCallback((Duration _) {
        if (mounted && _aResoudre != null) _resoudreChoix(bundle);
      });
    }
    // La société visitée et l'objet sont obligatoires : sans leurs listes, il
    // n'y a rien à enregistrer, et le bouton doit le montrer avant qu'on le
    // touche.
    final bool listesUtilisables =
        bundle != null &&
        bundle.entreprises.isNotEmpty &&
        bundle.objets.isNotEmpty;
    final TopLabels frequents =
        ref.watch(topLabelsVisitesProvider).value ?? TopLabels.vide;
    final bool horsLigne =
        ref.watch(connectivityProvider) != CpiConnectivity.online;

    final String? echec = _echec;
    final VisiteAvecStatut? rappel = _rappelRepris ? null : _rappel;
    final EtapeVisite etape = _etapes[_etape];
    final bool derniere = _etape == _etapes.length - 1;
    final String? manque = listesUtilisables
        ? _saisie.manque(etape)
        : 'Les listes de l\'accueil manquent';

    final Widget ecran = CpiScaffold(
      title: etape.question,
      showTitle: false,
      leading: CpiHeaderAction(
        icon: PhosphorIconsRegular.arrowLeft,
        label: _etape == 0 ? 'Retour' : 'Étape précédente',
        onPressed: _etape == 0 ? () => unawaited(_quitter()) : _precedent,
      ),
      banner: echec == null
          ? null
          : Builder(
              builder: (BuildContext toaster) => CpiStatusBand(
                text: echec,
                tone: CpiTone.danger,
                actionLabel: 'Réessayer',
                onAction: () => unawaited(_enregistrer(toaster)),
              ),
            ),
      body: Column(
        children: <Widget>[
          CpiStepHeader(
            step: _etape + 1,
            total: _etapes.length,
            question: etape.question,
          ),
          Expanded(
            child: ListView(
              // Une liste par étape : sans clé, la suivante hériterait du
              // défilement de la précédente et s'ouvrirait à mi-hauteur.
              key: ValueKey<EtapeVisite>(etape),
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                0,
                CpiSpacing.md,
                CpiSpacing.md,
              ),
              children: <Widget>[
                if (bundle == null)
                  const _ListesEnCours()
                else if (!listesUtilisables)
                  _ListesIndisponibles(
                    demandees: _listesDemandees,
                    onRecevoir: () {
                      setState(() => _listesDemandees = true);
                      ref.read(syncCoordinatorProvider.notifier).nudge();
                    },
                  )
                else ...<Widget>[
                  ChampsVisite(
                    saisie: _saisie,
                    bundle: bundle,
                    frequents: frequents,
                    etapes: <EtapeVisite>[etape],
                    autofocus: etape == EtapeVisite.qui,
                    // Le pied dépend de ce qui vient d'être choisi : sans
                    // cette reconstruction, « Continuer » resterait éteint.
                    onModifie: () {
                      setState(() {});
                      markDraftDirty();
                    },
                    rappel: rappel == null
                        ? null
                        : Builder(
                            builder: (BuildContext toaster) => _RappelVisiteur(
                              visite: rappel,
                              onReprendre: () => _reprendre(rappel, toaster),
                            ),
                          ),
                  ),
                  if (etape == EtapeVisite.pourQui) ...<Widget>[
                    const SizedBox(height: CpiSpacing.sm),
                    const _NoteDePied(
                      'Société visitée, personne demandée et étage restent '
                      'posés pour le visiteur suivant.',
                    ),
                  ],
                  if (derniere) ...<Widget>[
                    const SizedBox(height: CpiSpacing.md),
                    _LigneHeure(
                      moment: _moment,
                      saisiA: _saisiA,
                      onReculer: _reculerUnQuartDHeure,
                      onAutreHeure: _changerHeure,
                    ),
                    const SizedBox(height: CpiSpacing.md),
                    CpiRecap(
                      key: const ValueKey<String>('visite-recapitulatif'),
                      title: 'À inscrire',
                      lines: <CpiRecapLine>[
                        CpiRecapLine(
                          'Nom du visiteur',
                          _saisie.nom.text.trim(),
                        ),
                        CpiRecapLine(
                          'Téléphone',
                          Phone.displayed(_saisie.telephone.text),
                        ),
                        CpiRecapLine(
                          'Société visitée',
                          labelReferentiel(
                            bundle.entreprises,
                            _saisie.entrepriseId,
                          ),
                        ),
                        CpiRecapLine(
                          'Vient voir',
                          labelReferentiel(
                            bundle.destinataires,
                            _saisie.destinataireId,
                          ),
                        ),
                        CpiRecapLine(
                          'Objet de la visite',
                          labelReferentiel(bundle.objets, _saisie.objetId),
                        ),
                      ],
                    ),
                    if (horsLigne) ...<Widget>[
                      const SizedBox(height: CpiSpacing.sm),
                      const _NoteDePied(
                        'Hors ligne. La visite sera envoyée dès le retour du '
                        'réseau.',
                      ),
                    ],
                    const SizedBox(height: CpiSpacing.sm),
                    CpiButton(
                      'Vider et repartir à zéro',
                      key: const ValueKey<String>('visite-vider'),
                      variant: CpiButtonVariant.ghost,
                      onPressed: _viderTout,
                    ),
                  ],
                ],
              ],
            ),
          ),
        ],
      ),
      footer: CpiActionBar(
        child: derniere
            ? Builder(
                builder: (BuildContext toaster) => CpiButton(
                  _envoiEnCours ? 'Enregistrement…' : 'Enregistrer la visite',
                  key: const ValueKey<String>('visite-enregistrer'),
                  icon: PhosphorIconsRegular.checkCircle,
                  loading: _envoiEnCours,
                  subtitle: manque,
                  onPressed: manque == null && !_envoiEnCours
                      ? () => unawaited(_enregistrer(toaster))
                      : null,
                ),
              )
            : CpiButton(
                'Continuer',
                key: const ValueKey<String>('visite-continuer'),
                icon: PhosphorIconsRegular.arrowRight,
                subtitle: manque,
                onPressed: manque == null ? _suivant : null,
              ),
      ),
    );

    // Le retour système remonte d'UNE étape ; à la première, il repose la même
    // question que la flèche.
    return CpiStepScope(
      first: _etape == 0,
      onBack: _precedent,
      onExit: () => unawaited(_quitter()),
      fallback: Routes.accueil,
      child: ecran,
    );
  }
}

String _jourEnLettres(String date) {
  final DateTime? jour = DateTime.tryParse(date);
  if (jour == null) return date;
  return DateFormat('d MMMM', 'fr').format(jour);
}

/// La ligne d'arrivée : l'heure retenue, et de quoi la corriger sans feuille.
class _LigneHeure extends StatelessWidget {
  const _LigneHeure({
    required this.moment,
    required this.saisiA,
    required this.onReculer,
    required this.onAutreHeure,
  });

  final DateTime moment;
  final DateTime saisiA;
  final VoidCallback onReculer;
  final Future<void> Function(BuildContext context) onAutreHeure;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final String heure = heureDakar(moment);
    final String saisie = heureDakar(saisiA);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          heure == saisie
              ? 'Arrivé à $heure'
              : 'Arrivé à $heure (saisi à $saisie)',
          style: theme.textTheme.titleSmall,
        ),
        const SizedBox(height: CpiSpacing.xxs),
        // Empilés plutôt qu'en rangée si la place manque : à la plus grande
        // taille de texte, deux boutons ne tiennent pas côte à côte sur 320 dp.
        Wrap(
          spacing: CpiSpacing.xs,
          runSpacing: CpiSpacing.xs,
          children: <Widget>[
            CpiButton(
              '−15 min',
              key: const ValueKey<String>('visite-moins-15'),
              variant: CpiButtonVariant.secondary,
              expand: false,
              onPressed: onReculer,
            ),
            CpiButton(
              'Autre heure',
              key: const ValueKey<String>('visite-autre-heure'),
              variant: CpiButtonVariant.secondary,
              expand: false,
              onPressed: () => onAutreHeure(context),
            ),
          ],
        ),
      ],
    );
  }
}

class _NoteDePied extends StatelessWidget {
  const _NoteDePied(this.texte);

  final String texte;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Text(
      texte,
      style: theme.textTheme.bodySmall?.copyWith(
        color: theme.colorScheme.onSurfaceVariant,
      ),
    );
  }
}

/// « Déjà venu le 18 août » : la dernière visite d'un homonyme, à reprendre en
/// un geste.
class _RappelVisiteur extends StatelessWidget {
  const _RappelVisiteur({required this.visite, required this.onReprendre});

  final VisiteAvecStatut visite;
  final VoidCallback onReprendre;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final String details = <String>[
      if (visite.destinataireLabel != null) visite.destinataireLabel!,
      visite.objetLabel,
    ].join(' · ');
    return Padding(
      padding: const EdgeInsets.only(top: CpiSpacing.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            'Déjà venu le ${_jourEnLettres(visite.date)} : $details',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          CpiButton(
            'Reprendre',
            key: const ValueKey<String>('visite-reprendre'),
            variant: CpiButtonVariant.secondary,
            expand: false,
            onPressed: onReprendre,
          ),
        ],
      ),
    );
  }
}

/// `ListWheelScrollView` ne se dimensionne pas seul : la roue de la feuille a
/// besoin d'une hauteur explicite.
const double _hauteurRoue = 180;

String _deuxChiffres(int valeur) => valeur.toString().padLeft(2, '0');

/// Le choix de l'heure, à la roue ou au clavier.
///
/// La roue se règle au glissé, geste que ni un lecteur d'écran ni une main qui
/// tremble ne produisent : elle porte donc un nom, une valeur et des actions
/// d'ajustement, et la saisie au clavier donne le même résultat sans glisser.
class _FeuilleHeure extends StatefulWidget {
  const _FeuilleHeure({required this.initiale});

  final FTime initiale;

  @override
  State<_FeuilleHeure> createState() => _FeuilleHeureState();
}

class _FeuilleHeureState extends State<_FeuilleHeure> {
  late FTime _valeur = widget.initiale;
  bool _clavier = false;
  String? _erreurHeure;
  String? _erreurMinute;

  late final TextEditingController _heure = TextEditingController(
    text: _deuxChiffres(_valeur.hour),
  );
  late final TextEditingController _minute = TextEditingController(
    text: _deuxChiffres(_valeur.minute),
  );

  @override
  void dispose() {
    _heure.dispose();
    _minute.dispose();
    super.dispose();
  }

  static String _texte(FTime time) =>
      '${_deuxChiffres(time.hour)}:${_deuxChiffres(time.minute)}';

  FTime _decalee(int minutes) {
    const int jour = 24 * 60;
    final int total =
        (_valeur.hour * 60 + _valeur.minute + minutes + jour) % jour;
    return FTime(total ~/ 60, total % 60);
  }

  void _regler(FTime valeur) {
    setState(() {
      _valeur = valeur;
      _erreurHeure = null;
      _erreurMinute = null;
      _heure.text = _deuxChiffres(valeur.hour);
      _minute.text = _deuxChiffres(valeur.minute);
    });
  }

  void _valider() {
    if (!_clavier) {
      Navigator.of(context).pop(_valeur);
      return;
    }
    final int? heure = int.tryParse(_heure.text.trim());
    final int? minute = int.tryParse(_minute.text.trim());
    if (heure == null || heure > 23 || minute == null || minute > 59) {
      setState(() {
        _erreurHeure = heure == null || heure > 23 ? 'Entre 00 et 23.' : null;
        _erreurMinute = minute == null || minute > 59
            ? 'Entre 00 et 59.'
            : null;
      });
      return;
    }
    Navigator.of(context).pop(FTime(heure, minute));
  }

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      if (_clavier) _champs(context) else _roue(context),
      const SizedBox(height: CpiSpacing.xs),
      CpiButton(
        _clavier ? 'Choisir à la roue' : 'Saisir au clavier',
        variant: CpiButtonVariant.ghost,
        icon: _clavier
            ? PhosphorIconsRegular.clockCounterClockwise
            : PhosphorIconsRegular.keyboard,
        onPressed: () => setState(() {
          _clavier = !_clavier;
          _erreurHeure = null;
          _erreurMinute = null;
          _heure.text = _deuxChiffres(_valeur.hour);
          _minute.text = _deuxChiffres(_valeur.minute);
        }),
      ),
      const SizedBox(height: CpiSpacing.md),
      CpiButton('Valider', onPressed: _valider),
      const SizedBox(height: CpiSpacing.xs),
      CpiButton(
        'Annuler',
        variant: CpiButtonVariant.ghost,
        onPressed: () => Navigator.of(context).pop(),
      ),
    ],
  );

  /// Forui 0.21.3 construit les deux roues DANS `FTimePicker`, et `FPicker`
  /// n'accepte que des `FPickerWheelMixin` en enfants directs : aucune des deux
  /// ne peut recevoir sa propre annonce. Le sélecteur porte donc un seul nœud,
  /// nommé, valué et ajustable à la minute.
  Widget _roue(BuildContext context) => Semantics(
    container: true,
    // Pas « Heure de la visite » : c'est le titre de la feuille, et deux nœuds
    // du même nom ne se distinguent plus à l'oreille.
    label: 'Heure choisie',
    value: _texte(_valeur),
    increasedValue: _texte(_decalee(1)),
    decreasedValue: _texte(_decalee(-1)),
    onIncrease: () => _regler(_decalee(1)),
    onDecrease: () => _regler(_decalee(-1)),
    excludeSemantics: true,
    child: SizedBox(
      // `ListWheelScrollView` prend toute la hauteur qu'on lui donne : dans une
      // feuille qui se dimensionne sur son contenu, il n'en reçoit aucune.
      height: _hauteurRoue,
      child: FTimePicker(
        hour24: true,
        control: FTimePickerControl.lifted(
          time: _valeur,
          onChange: (FTime valeur) => setState(() => _valeur = valeur),
        ),
      ),
    ),
  );

  Widget _champs(BuildContext context) => Row(
    spacing: CpiSpacing.sm,
    crossAxisAlignment: CrossAxisAlignment.start,
    children: <Widget>[
      Expanded(
        child: CpiField(
          key: const ValueKey<String>('visite-heure'),
          label: 'Heure',
          controller: _heure,
          keyboardType: TextInputType.number,
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(2),
          ],
          error: _erreurHeure,
          description: '00 à 23',
        ),
      ),
      Expanded(
        child: CpiField(
          key: const ValueKey<String>('visite-minute'),
          label: 'Minutes',
          controller: _minute,
          keyboardType: TextInputType.number,
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(2),
          ],
          error: _erreurMinute,
          description: '00 à 59',
        ),
      ),
    ],
  );
}

class _ListesEnCours extends StatelessWidget {
  const _ListesEnCours();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        const FCircularProgress(size: FCircularProgressSizeVariant.sm),
        const SizedBox(width: CpiSpacing.xs),
        Expanded(
          child: Text(
            'Chargement des listes de l\'accueil…',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
      ],
    );
  }
}

class _ListesIndisponibles extends ConsumerWidget {
  const _ListesIndisponibles({
    required this.onRecevoir,
    required this.demandees,
  });

  final VoidCallback onRecevoir;

  /// Une réception a déjà été demandée : ce qui manque n'est plus une attente,
  /// c'est un échec, et il se dit autrement.
  final bool demandees;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bool enCours = ref.watch(syncCoordinatorProvider).running;
    final String message;
    if (enCours) {
      message = 'Réception des listes…';
    } else if (demandees) {
      message =
          'Toujours rien reçu. Vérifiez le réseau, ou appelez '
          'l\'administrateur.';
    } else {
      message =
          'Les listes de l\'accueil ne sont pas encore sur ce téléphone. '
          'Connectez-vous au réseau, puis touchez « Recevoir les listes ».';
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        CpiStatusBand(
          text: message,
          tone: enCours ? CpiTone.neutral : CpiTone.warning,
        ),
        const SizedBox(height: CpiSpacing.sm),
        CpiButton(
          'Recevoir les listes',
          variant: CpiButtonVariant.secondary,
          icon: PhosphorIconsRegular.arrowClockwise,
          onPressed: enCours ? null : onRecevoir,
        ),
      ],
    );
  }
}
