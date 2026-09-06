import 'dart:async';
import 'dart:io';

import 'package:crm_api_client/crm_api_client.dart'
    show ChampLibreDto, ChampLibreDtoTypeEnum, Projet;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/drafts/draft_form_mixin.dart';
import '../../../core/ouvertures/ouverture_fiche_mixin.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/sync/phase2_directory_sync.dart';
import '../../../core/telephonie/appels_crm.dart';
import '../../../core/utils/relative_time.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../core/utils/whatsapp.dart'
    show WhatsappStatus, kProfessionMaxLength;
import '../../../data/local/database.dart';
import '../../../data/repositories/draft_repository.dart';
import '../../../data/repositories/ouverture_repository.dart';
import '../../../data/repositories/reference_repository.dart';
import '../../../data/repositories/write_repository.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_choice_group.dart';
import '../../../ui/widgets/cpi_forui.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/cpi_steps.dart';
import '../../../ui/widgets/local_typeahead.dart';
import '../../../ui/widgets/phone_field.dart';
import '../../representant/presentation/representant_form_screen.dart'
    show kProfessionsFrequentes;
import '../../shell/projects.dart';
import '../phase2_controller.dart';
import '../regles_conversion.dart';
import 'callback_picker.dart';
import 'call_audio_recorder.dart';

class Phase2Screen extends ConsumerStatefulWidget {
  const Phase2Screen({super.key, this.prefillPhone});

  /// Le numero de la fiche depuis laquelle on arrive, quand on vient d'une file
  /// d’appel. Sans lui, ouvrir une fiche rendait un écran vide
  /// et le teleconseiller retapait le numero qu'il venait de choisir.
  final String? prefillPhone;

  @override
  ConsumerState<Phase2Screen> createState() => _Phase2ScreenState();
}

class _Phase2ScreenState extends ConsumerState<Phase2Screen>
    with DraftFormMixin<Phase2Screen>, OuvertureFicheMixin<Phase2Screen> {
  final TextEditingController _phone = TextEditingController();
  final FocusNode _phoneFocus = FocusNode();

  final Phase2FormFields _form = Phase2FormFields();
  final TextEditingController _comment = TextEditingController();

  String? _lastSearched;
  String? _recordingPath;
  String? _activeRecordingPath;
  bool _savingRecording = false;

  /// 1 : qui a été appelé. 2 à 4 : ce qu'on a appris de lui, par bloc de trois
  /// ou quatre questions. 5 : ce que l'appel a donné.
  int _step = 1;

  static const int _etapes = 5;

  static const List<String> _questions = <String>[
    'Qui avez-vous appelé ?',
    'Qui est-ce ?',
    'Son travail',
    'Sa banque, son syndicat',
    'Comment la personne s\'inscrit-elle ?',
  ];

  /// Ce que la flèche du bandeau ramène, dit par sa destination.
  static const List<String> _retours = <String>[
    '',
    '',
    'Revenir au numéro',
    'Revenir à la personne',
    'Revenir à son travail',
    'Revenir à sa banque',
  ];
  bool _noteOuverte = false;

  /// Ce que l'ouverture ou le verrou vient de dire. Bande et non toast : le
  /// message doit rester lisible tant que l'appel n'est pas consigné.
  String? _echecOuverture;

  bool get _recordingActive => _activeRecordingPath != null;

  /// EB-10 : la saisie survit au changement de numéro et à la mort de l'app.
  /// Le brouillon est rangé SOUS LE NUMÉRO appelé : rappeler la même personne
  /// rouvre ses réponses, appeler quelqu'un d'autre part d'un formulaire vide.
  @override
  String get draftId => 'phase2:${_lastSearched ?? ''}';

  @override
  String get draftFormKey => 'phase2_appel';

  @override
  String? get draftEntityId => _lastSearched;

  @override
  int get draftStep => _step;

  @override
  DraftRepository get draftRepository => ref.read(draftRepositoryProvider);

  /// Sans numéro cherché, le brouillon n'appartient à personne.
  @override
  bool get draftIsEmpty => _lastSearched == null;

  @override
  Map<String, Object?> collectDraftValues() => <String, Object?>{
    ..._form.toDraft(),
    'comment': _comment.text,
  };

  @override
  void initState() {
    super.initState();
    final String? prefill = widget.prefillPhone;
    // La file passe un numéro E.164 ; le champ, lui, porte déjà « +221 » en
    // préfixe. Sans conversion, l'écran affichait « +221 +221781001004 ».
    if (prefill != null && prefill.isNotEmpty) {
      _phone.text = Phone.editable(prefill);
    }
    _phone.addListener(_onPhoneChanged);
    _comment.addListener(_saisie);
    _form.watch(() {
      _saisie();
      if (mounted) setState(() {});
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _form.grandPublic = ProjectScope.maybeOf(context) == CpiProject.grandPublic;
  }

  /// Une lettre tapée ou une case cochée : le brouillon est sale, et c'est de
  /// là que part le chronomètre.
  ///
  /// Le formulaire s'écrit aussi tout seul : le vidage, la reprise du
  /// brouillon et le pré-remplissage depuis la fiche notifient les mêmes
  /// écouteurs sans que personne n'ait rien saisi.
  void _saisie() {
    markDraftDirty();
    if (_ecritSeul) return;
    unawaited(premiereSaisie(collectDraftValues()));
  }

  bool _ecritSeul = false;

  void _sansSaisie(VoidCallback ecrire) {
    _ecritSeul = true;
    try {
      ecrire();
    } finally {
      _ecritSeul = false;
    }
  }

  @override
  void dispose() {
    if (!_savingRecording) _discardRecording();
    _phone.removeListener(_onPhoneChanged);
    _comment.removeListener(_saisie);
    _phone.dispose();
    _phoneFocus.dispose();
    _comment.dispose();
    _form.dispose();
    super.dispose();
  }

  void _onPhoneChanged() {
    final String raw = _phone.text;
    final PhoneResult parsed = Phone.parse(raw);
    if (parsed is! PhoneValid) {
      if (_lastSearched != null) unawaited(_changerDeNumero(null));
      return;
    }
    if (_lastSearched == parsed.e164) return;
    unawaited(_changerDeNumero(parsed.e164));
  }

  /// La saisie du numéro qu'on quitte est écrite AVANT de changer de clé :
  /// après, elle irait se ranger sous le numéro suivant, ou nulle part.
  Future<void> _changerDeNumero(String? e164) async {
    await flushDraft();
    if (!mounted) return;
    _discardRecording();
    _lastSearched = e164;
    _noteOuverte = false;
    if (e164 == null) {
      ref.read(phase2ControllerProvider.notifier).next();
      return;
    }
    // Un autre numéro, c'est une autre personne : ses renseignements ne se
    // reprennent pas de l'appel précédent.
    _sansSaisie(() {
      _form.clear();
      _comment.clear();
    });
    await _runSearch(e164);
    if (!mounted) return;
    await _reprendreLeBrouillon();
    if (!mounted) return;
    await _prendreLaFiche();
  }

  /// EB-07 : la confirmation se pose une fois la fiche IDENTIFIÉE. Tant
  /// qu'aucune personne n'est désignée, il n'y a rien à ouvrir, rien à
  /// verrouiller et rien à chronométrer : taper un numéro et chercher reste
  /// libre.
  ///
  /// La fiche déjà tenue par ce compte se rouvre SANS redemander : c'est la
  /// reprise après une fermeture ou un plantage, et chaque confirmation compte
  /// une ouverture de plus.
  Future<void> _prendreLaFiche() async {
    final Phase2State phase2 = ref.read(phase2ControllerProvider);
    final Phase2DirectoryData? entry = phase2.entry;
    if (entry == null || phase2.stage != Phase2Stage.capture) return;
    if (compteConnecte == null) return;

    final OuverturesFicheData? deja = await ficheEnCours();
    if (!mounted) return;
    if (deja?.prospectId != entry.prospectId) {
      final bool ouvrir = await confirmerLOuverture(
        _nomDeLaFiche(phase2.prospect) ?? Phone.format(entry.phoneE164),
      );
      if (!mounted) return;
      if (!ouvrir) {
        await _viderPourLeSuivant();
        return;
      }
    }

    final OuvertureResultat resultat;
    try {
      resultat = await ouvrirLaFiche(prospectId: entry.prospectId);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _echecOuverture = 'Ouverture impossible. $error');
      return;
    }
    if (!mounted) return;
    final FicheTenue? tenue = resultat.tenue;
    if (tenue != null) await _proposerLaFicheTenue(tenue);
  }

  static String? _nomDeLaFiche(Prospect? fiche) {
    if (fiche == null) return null;
    final String nom = '${fiche.prenom} ${fiche.nom}'.trim();
    return nom.isEmpty ? null : nom;
  }

  /// Le verrou refuse la seconde fiche sans dire laquelle il tient. Sans cette
  /// issue, le téléconseiller reste devant un refus qu'il ne peut pas lever :
  /// une fiche de représentant se reprend par sa route, celle d'un prospect en
  /// rappelant son numéro.
  Future<void> _proposerLaFicheTenue(FicheTenue tenue) async {
    // Le dépôt se lit AVANT les attentes : après, le widget peut être démonté.
    final ReferenceRepository refs = ref.read(referenceRepositoryProvider);
    final String? representant = tenue.representantId;
    final String? prospectId = tenue.prospectId;
    final Prospect? prospect = prospectId == null
        ? null
        : await refs.prospectById(prospectId);
    final String? nom = representant == null
        ? _nomDeLaFiche(prospect) ?? tenue.ficheNom
        : (await refs.representantById(representant))?.fullName ??
              tenue.ficheNom;
    final bool reprenable = representant != null || prospect != null;
    if (!mounted) return;
    final bool? reprendre = await cpiConfirm(
      context,
      title: 'Fiche en cours',
      message: nom == null
          ? 'Vous tenez déjà une fiche. Qualifiez-la avant d\'en ouvrir une autre.'
          : 'Vous tenez déjà la fiche de $nom. Qualifiez-la avant d\'en ouvrir une autre.',
      confirmLabel: reprenable ? 'Reprendre' : 'Revenir',
      cancelLabel: 'Revenir',
    );
    if (!mounted) return;
    if (reprendre == true && representant != null) {
      context.go(Routes.representantQualificationFor(representant));
      return;
    }
    await _viderPourLeSuivant();
    if (reprendre == true && prospect != null) {
      // Le champ relance la recherche, et la fiche déjà tenue se rouvre sans
      // redemander.
      _phone.text = Phone.editable(prospect.phoneE164);
    }
  }

  /// Ce que le dernier appel à ce numéro avait laissé en chemin. Repris avant
  /// `prefill`, qui n'écrase jamais un champ déjà rempli.
  Future<void> _reprendreLeBrouillon() async {
    final DraftSnapshot? repris = await draftRepository.read(draftId);
    if (repris == null || !mounted) return;
    setState(() {
      _sansSaisie(() {
        _form.applyDraft(repris.values);
        final Object? comment = repris.values['comment'];
        if (comment is String) _comment.text = comment;
      });
    });
  }

  Future<void> _runSearch(String e164) async {
    await ref.read(phase2ControllerProvider.notifier).search(e164);
    if (!mounted) return;
    final Phase2Stage stage = ref.read(phase2ControllerProvider).stage;
    if (stage == Phase2Stage.notFound || stage == Phase2Stage.horsPerimetre) {
      await HapticFeedback.heavyImpact();
    }
  }

  void _resetForNext() => unawaited(_viderPourLeSuivant());

  /// Le brouillon du numéro qu'on quitte est écrit AVANT le vidage : sinon la
  /// prochaine écriture rangerait un formulaire vide sous son nom.
  Future<void> _viderPourLeSuivant() async {
    await flushDraft();
    if (!mounted) return;
    _discardRecording();
    _lastSearched = null;
    _phone.clear();
    _sansSaisie(() {
      _comment.clear();
      _form.clear();
    });
    setState(() {
      _step = 1;
      _noteOuverte = false;
      _echecOuverture = null;
    });
    ref.read(phase2ControllerProvider.notifier).next();
    _phoneFocus.requestFocus();
  }

  void _discardRecording() {
    for (final String? path in <String?>{
      _recordingPath,
      _activeRecordingPath,
    }) {
      if (path == null) continue;
      final File recording = File(path);
      if (recording.existsSync()) recording.deleteSync();
    }
    _recordingPath = null;
    _activeRecordingPath = null;
  }

  Future<void> _record({
    required CallReason reason,
    String? method,
    String? comment,
    DateTime? callbackAt,
    DateTime? rendezVousAt,
  }) async {
    bool ok = false;
    _savingRecording = true;
    try {
      ok = await ref
          .read(phase2ControllerProvider.notifier)
          .record(
            reason: reason,
            method: method,
            comment: comment,
            callbackAt: callbackAt,
            recordingPath: _recordingPath,
            renseignements: _form.read(),
            rendezVousAt: rendezVousAt,
            // Ferme l'ouverture et arrête le chronomètre, ici comme au serveur.
            ouvertureId: ouverture?.id,
          );
      if (ok) {
        _recordingPath = null;
        libererLeVerrou();
        _echecOuverture = null;
        // EB-10 : un rappel promis garde les réponses pour la prochaine fois.
        // Un appel conclu, non : les rouvrir ferait ressaisir un dossier clos.
        if (reason.effect == CallEffects.scheduleCallback) {
          await flushDraft();
        } else {
          discardDraft();
          await draftRepository.delete(draftId);
        }
      }
    } finally {
      _savingRecording = false;
      if (!mounted && !ok) _discardRecording();
    }
    if (!mounted) return;
    if (!ok) {
      await HapticFeedback.heavyImpact();
      return;
    }
    // La confirmation vit à la dernière étape : consignée depuis une étape de
    // renseignements, elle n'aurait sinon aucun endroit où s'afficher.
    setState(() => _step = _etapes);
    await HapticFeedback.mediumImpact();
  }

  bool get _peutReculer => !_recordingActive;

  /// Le rang réellement peint. Les états qui ne parlent que du numéro (absent,
  /// dossier déjà clos) ramènent à l'étape 1 quoi qu'ait choisi l'écran.
  int get _etape {
    final Phase2Stage stage = ref.read(phase2ControllerProvider).stage;
    if (stage == Phase2Stage.capture || stage == Phase2Stage.confirmed) {
      return _step;
    }
    return 1;
  }

  @override
  Widget build(BuildContext context) {
    final Phase2State phase2 = ref.watch(phase2ControllerProvider);
    final CpiMotion motion = CpiMotion.of(context);
    // Avant la première synchronisation la table est vide et le repli sert les
    // six motifs système : la saisie ne dépend jamais du réseau.
    final List<CallReason> reasons =
        ref.watch(callReasonsProvider).value ?? SystemCallReasons.all;
    // Suivis ici et non dans l'étape 2 : le pré-remplissage lit ces listes au
    // moment où l'on quitte l'étape 1, il faut donc qu'elles soient déjà là.
    final List<Banque> banques = ref.watch(banquesProvider).value ?? const [];
    final List<Syndicat> syndicats =
        ref.watch(syndicatsProvider).value ?? const [];
    final List<IncomeBand> tranches =
        ref.watch(incomeBandsProvider).value ?? const [];
    // EB-27 : posé sur le formulaire avant qu'il ne dise ce qui lui manque, la
    // barre de pied lisant le reproche dans le même passage.
    _form.regles =
        ref
            .watch(
              reglesConversionProvider(
                _form.grandPublic ? Projet.GRAND_PUBLIC : Projet.CHUES,
              ),
            )
            .value ??
        ReglesConversion.aucune;
    final int etape = _etape;

    final Widget screen = CpiScaffold(
      title: 'Consigner un appel',
      showTitle: false,
      leading: etape == 1 && !sousVerrou
          ? const CpiBackButton()
          : CpiHeaderAction(
              icon: PhosphorIconsRegular.arrowLeft,
              label: etape == 1 ? 'Retour' : _retours[etape],
              onPressed: etape == 1
                  ? _quitter
                  : (_peutReculer && !phase2.saving && !_confirme
                        ? _precedent
                        : null),
            ),
      banner: switch (_echecOuverture) {
        final String message => CpiStatusBand(
          text: message,
          tone: CpiTone.warning,
        ),
        _ => null,
      },
      footer: switch (etape) {
        1 => _EtapeUnAction(
          onContinue: () => _versLesRenseignements(banques, syndicats),
        ),
        _ when etape == _etapes => null,
        _ => _EtapeAction(
          manque: _form.manqueEtape(etape),
          onContinue: _suivant,
          // Le dossier complet n'est exigé que pour une adhésion : un appel qui
          // n'a pas abouti se consigne sans quitter l'étape où il s'est arrêté.
          onNegative: phase2.saving ? null : () => _openNegativeSheet(reasons),
        ),
      },
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          CpiSpacing.md,
          0,
          CpiSpacing.md,
          CpiSpacing.xl,
        ),
        children: <Widget>[
          ?chronometre(Theme.of(context)),
          CpiStepHeader(
            step: etape,
            total: _etapes,
            question: _questions[etape - 1],
          ),
          AnimatedSwitcher(
            duration: motion.component,
            switchInCurve: motion.easeOut,
            switchOutCurve: motion.easeOut,
            child: KeyedSubtree(
              key: ValueKey<String>(
                '$etape:${phase2.stage.name}:${phase2.entry?.prospectId ?? ''}',
              ),
              child: switch (etape) {
                1 => _EtapeQui(
                  state: phase2,
                  controller: _phone,
                  focusNode: _phoneFocus,
                  onClear: _resetForNext,
                  onNext: _resetForNext,
                  verrouille: sousVerrou,
                ),
                2 || 3 || 4 => _EtapeRenseignements(
                  etape: etape,
                  fields: _form,
                  banques: banques,
                  syndicats: syndicats,
                  tranches: tranches,
                  onChanged: () {
                    _saisie();
                    setState(() {});
                  },
                ),
                _ => _EtapeResultat(
                  state: phase2,
                  comment: _comment,
                  recap: _form.recap,
                  recording: _recordingActive,
                  noteOuverte: _noteOuverte,
                  onOuvrirNote: () => setState(() => _noteOuverte = true),
                  onRecordingChanged: (String? path) => _recordingPath = path,
                  onRecordingStateChanged: (String? path) {
                    setState(() => _activeRecordingPath = path);
                  },
                  onMethod: (String method) => _record(
                    reason: methodReasonOf(reasons),
                    method: method,
                    comment: _comment.text,
                  ),
                  onRendezVous: () => _openRendezVousSheet(reasons),
                  onNegative: () => _openNegativeSheet(reasons),
                  onNext: _resetForNext,
                ),
              },
            ),
          ),
        ],
      ),
    );

    // Le retour système recule d'une étape : il ne quitte l'écran que depuis
    // l'étape 1, comme la flèche du bandeau.
    return CpiStepScope(
      first: etape == 1,
      onExit: sousVerrou ? _quitter : null,
      onBack: _peutReculer && !_confirme ? _precedent : null,
      child: screen,
    );
  }

  /// EB-08 : une fiche ouverte ne se quitte pas, elle se qualifie.
  void _quitter() {
    if (sousVerrou) {
      setState(
        () =>
            _echecOuverture = 'Consignez cet appel avant de quitter la fiche.',
      );
      return;
    }
    popOrHome(context);
  }

  void _precedent() => setState(() => _step = _etape - 1);

  void _suivant() {
    setState(() => _step = _etape + 1);
    unawaited(remonterLeBrouillon(collectDraftValues()));
  }

  bool get _confirme =>
      ref.read(phase2ControllerProvider).stage == Phase2Stage.confirmed;

  void _versLesRenseignements(List<Banque> banques, List<Syndicat> syndicats) {
    final Phase2State phase2 = ref.read(phase2ControllerProvider);
    _sansSaisie(
      () => _form.prefill(
        phase2.prospect,
        phoneE164: phase2.entry?.phoneE164 ?? '',
        banques: banques,
        syndicats: syndicats,
      ),
    );
    setState(() => _step = 2);
  }

  Future<void> _openRendezVousSheet(List<CallReason> reasons) async {
    final DateTime? at = await showCpiSheet<DateTime>(
      context,
      title: 'RDV CPI',
      builder: (BuildContext context) =>
          RendezVousSheet(now: ref.read(clockProvider).now()),
    );
    if (at == null || !mounted) return;
    await _record(
      reason: methodReasonOf(reasons),
      method: EnrollmentMethods.appointment,
      comment: _comment.text,
      rendezVousAt: at,
    );
  }

  Future<void> _openNegativeSheet(List<CallReason> reasons) async {
    final CallOutcomeChoice? result = await showCpiSheet<CallOutcomeChoice>(
      context,
      title: 'L\'appel n\'a pas abouti',
      builder: (BuildContext context) => CallOutcomeSheet(
        now: ref.read(clockProvider).now(),
        reasons: reasons,
      ),
    );
    if (result == null || !mounted) return;
    await _record(
      reason: result.reason,
      comment: result.comment,
      callbackAt: result.callbackAt,
    );
  }
}

/// Les champs de l'étape « Renseignements », tenus hors du `State` de l'écran :
/// treize contrôleurs et deux tri-états y noieraient le pilotage des étapes.
class Phase2FormFields {
  final TextEditingController nom = TextEditingController();
  final TextEditingController prenom = TextEditingController();
  final TextEditingController telephone = TextEditingController();
  final TextEditingController email = TextEditingController();
  final TextEditingController profession = TextEditingController();
  final TextEditingController duree = TextEditingController();
  final TextEditingController banque = TextEditingController();
  final TextEditingController syndicat = TextEditingController();
  final TextEditingController revenu = TextEditingController();
  final TextEditingController whatsapp = TextEditingController();

  final FocusNode nomFocus = FocusNode();
  final FocusNode prenomFocus = FocusNode();
  final FocusNode emailFocus = FocusNode();
  final FocusNode professionFocus = FocusNode();
  final FocusNode dureeFocus = FocusNode();
  final FocusNode banqueFocus = FocusNode();
  final FocusNode syndicatFocus = FocusNode();
  final FocusNode revenuFocus = FocusNode();
  final FocusNode whatsappFocus = FocusNode();

  String? banqueId;
  String? syndicatId;
  String? incomeBandId;
  int? dureeSystemeMois;
  Tri fonctionnaire = Tri.nonDemande;
  Tri engagementEnCours = Tri.nonDemande;

  /// EB-23 : « ce numéro est-il un numéro WhatsApp ? ». Non ouvre un second
  /// numéro, facultatif.
  Tri whatsappMemeNumero = Tri.nonDemande;

  /// EB-22 : le Grand Public garde la durée du système de paiement, que la
  /// conversion CHUES ne demande plus.
  bool grandPublic = false;

  /// EB-27 : ce que l'administration a masqué, exigé, ordonné et ajouté.
  ReglesConversion regles = ReglesConversion.aucune;

  /// Les réponses aux champs ajoutés, par identifiant de champ. Les champs
  /// texte ont en plus leur contrôleur, créé à leur première apparition.
  final Map<String, String> champsLibres = <String, String>{};
  final Map<String, TextEditingController> _libresTexte =
      <String, TextEditingController>{};

  VoidCallback? _surSaisie;

  /// Redessine l'étape à chaque frappe des champs qui peuvent la retenir.
  ///
  /// Sur l'écouteur du contrôleur et non sur `onChanged` du champ : ForUI
  /// notifie le changement AVANT de poser le texte, si bien que le reproche et
  /// le bouton étaient en retard d'une frappe : la dernière lettre, celle qui
  /// invalide l'adresse, laissait « Continuer » allumé.
  void watch(VoidCallback onChanged) {
    _surSaisie = onChanged;
    nom.addListener(onChanged);
    prenom.addListener(onChanged);
    email.addListener(onChanged);
    profession.addListener(onChanged);
    duree.addListener(onChanged);
    whatsapp.addListener(onChanged);
  }

  /// Le contrôleur d'un champ texte ajouté par l'administration. Créé à la
  /// demande : la liste des champs n'est connue qu'une fois les réglages lus.
  TextEditingController libreTexte(String id) =>
      _libresTexte.putIfAbsent(id, () {
        final TextEditingController controleur = TextEditingController(
          text: champsLibres[id] ?? '',
        );
        final VoidCallback? ecouteur = _surSaisie;
        if (ecouteur != null) controleur.addListener(ecouteur);
        return controleur;
      });

  /// Les réponses telles qu'elles partent : les champs texte lisent leur
  /// contrôleur, les listes leur valeur choisie, et le vide ne part pas.
  Map<String, String> get reponsesLibres {
    final Map<String, String> reponses = <String, String>{...champsLibres};
    for (final MapEntry<String, TextEditingController> entree
        in _libresTexte.entries) {
      reponses[entree.key] = entree.value.text.trim();
    }
    reponses.removeWhere((String _, String valeur) => valeur.isEmpty);
    return reponses;
  }

  /// Le premier champ ajouté qui reste sans réponse alors qu'il est exigé.
  String? get manqueLibre {
    final Map<String, String> reponses = reponsesLibres;
    for (final ChampLibreDto champ in regles.libres) {
      if (!champ.obligatoire) continue;
      if ((reponses[champ.id] ?? '').isEmpty) {
        return 'Renseignez « ${champ.libelle} »';
      }
    }
    return null;
  }

  String? get erreurEmail {
    final String value = email.text.trim();
    if (value.isEmpty) return null;
    return WriteRepository.validateCallAttemptEmail(value) == null
        ? null
        : 'Adresse invalide. Exemple : awa.sy@exemple.sn';
  }

  String? get erreurDuree {
    final String value = duree.text.trim();
    if (value.isEmpty) return null;
    final int? mois = int.tryParse(value);
    return mois != null && mois >= 0 && mois <= kDureeEtablissementMaxMois
        ? null
        : 'De 0 à $kDureeEtablissementMaxMois mois';
  }

  /// Le second numéro reste FACULTATIF : vide, la réponse « non » vaut « pas de
  /// WhatsApp ». Écrit à moitié, elle ne vaut rien et se reproche.
  String? get erreurWhatsapp {
    if (whatsappMemeNumero != Tri.non) return null;
    if (whatsapp.text.trim().isEmpty) return null;
    return Phone.parse(whatsapp.text) is PhoneValid ? null : 'Numéro incomplet';
  }

  /// Le couple EB-23 tel qu'il part. `null` quand la question n'a pas été
  /// posée : le serveur laisse alors la fiche telle quelle.
  String? get whatsappStatus => switch (whatsappMemeNumero) {
    Tri.oui => WhatsappStatus.memeNumero.code,
    Tri.non =>
      whatsappE164 == null
          ? WhatsappStatus.aucun.code
          : WhatsappStatus.autreNumero.code,
    Tri.nonDemande => null,
  };

  String? get whatsappE164 =>
      whatsappMemeNumero == Tri.non ? Phone.toE164(whatsapp.text) : null;

  bool _exige(String champ, {required bool defaut}) =>
      regles.requis(champ, defaut: defaut);

  /// Ce qui manque à l'identité. L'e-mail reste FACULTATIF sauf réglage
  /// contraire : il n'est sinon reproché que mal écrit.
  String? get manqueQui {
    if (_exige('nom', defaut: true) && nom.text.trim().isEmpty) {
      return 'Indiquez le nom';
    }
    if (_exige('prenom', defaut: true) && prenom.text.trim().isEmpty) {
      return 'Indiquez le prénom';
    }
    if (_exige('email', defaut: false) && email.text.trim().isEmpty) {
      return 'Indiquez l\'e-mail';
    }
    if (erreurEmail != null) return 'Vérifiez l\'e-mail';
    return erreurWhatsapp == null ? null : 'Vérifiez le numéro WhatsApp';
  }

  String? get manqueTravail {
    if (_exige('profession', defaut: true) && profession.text.trim().isEmpty) {
      return 'Indiquez la profession';
    }
    if (_exige('dureeEtablissementMois', defaut: true) &&
        duree.text.trim().isEmpty) {
      return 'Indiquez la durée dans la fonction';
    }
    if (erreurDuree != null) return 'Vérifiez la durée en mois';
    return _exige('fonctionnaire', defaut: true) && fonctionnaire.value == null
        ? 'Répondez à « Fonctionnaire »'
        : null;
  }

  String? get manqueBanque {
    if (_exige('syndicatId', defaut: true) && syndicatId == null) {
      return 'Choisissez le syndicat';
    }
    if (_exige('banqueId', defaut: true) && banqueId == null) {
      return 'Choisissez la banque';
    }
    if (_exige('engagementEnCours', defaut: true) &&
        engagementEnCours.value == null) {
      return 'Répondez à « Engagement en cours »';
    }
    if (_exige('incomeBandId', defaut: true) && incomeBandId == null) {
      return 'Choisissez le revenu mensuel';
    }
    if (_exige('dureeSystemeMois', defaut: grandPublic) &&
        dureeSystemeMois == null) {
      return 'Choisissez la durée du système';
    }
    return manqueLibre;
  }

  /// La durée du système de paiement ne concerne que le Grand Public, sauf si
  /// l'administration la rend visible ailleurs.
  bool get montreDureeSysteme =>
      regles.visible('dureeSystemeMois', defaut: grandPublic);

  /// Le premier champ qui manque au dossier. Une adhésion l'exige entier ; un
  /// appel qui n'a pas abouti, non.
  String? get manque => manqueQui ?? manqueTravail ?? manqueBanque;

  /// Le même reproche, ramené à l'étape qui porte le champ fautif : une étape
  /// ne retient jamais sur une saisie qu'elle ne montre pas.
  String? manqueEtape(int etape) => switch (etape) {
    2 => manqueQui,
    3 => manqueTravail,
    4 => manqueBanque,
    _ => null,
  };

  /// Ce que la dernière étape rappelle avant de consigner l'appel.
  List<CpiRecapLine> get recap => <CpiRecapLine>[
    CpiRecapLine('Nom complet', '${prenom.text} ${nom.text}'.trim()),
    CpiRecapLine('Téléphone', telephone.text),
    CpiRecapLine('Profession', profession.text),
    CpiRecapLine('Revenu mensuel', revenu.text),
    if (grandPublic)
      CpiRecapLine(
        'Durée du système',
        dureeSystemeMois == null ? null : formatDureeMois(dureeSystemeMois!),
      ),
  ];

  Phase2Renseignements read() => Phase2Renseignements(
    nom: _texte(nom),
    prenom: _texte(prenom),
    email: _texte(email),
    profession: _texte(profession),
    dureeEtablissementMois: int.tryParse(duree.text.trim()),
    fonctionnaire: fonctionnaire.value,
    syndicatId: syndicatId,
    banqueId: banqueId,
    engagementEnCours: engagementEnCours.value,
    incomeBandId: incomeBandId,
    dureeSystemeMois: montreDureeSysteme ? dureeSystemeMois : null,
    whatsappStatus: whatsappStatus,
    whatsappE164: whatsappE164,
    champsLibres: reponsesLibres,
  );

  /// Reprend ce que la fiche locale sait déjà, sans jamais écraser une saisie.
  /// L'annuaire ne porte qu'un numéro : sans fiche descendue par le pull, il
  /// n'y a rien à reprendre et les champs restent vides.
  void prefill(
    Prospect? prospect, {
    required String phoneE164,
    required List<Banque> banques,
    required List<Syndicat> syndicats,
  }) {
    telephone.text = phoneE164.isEmpty ? '' : Phone.format(phoneE164);
    if (prospect == null) return;
    _fill(nom, prospect.nom);
    _fill(prenom, prospect.prenom);
    _fill(profession, prospect.profession);
    if (banqueId == null && banque.text.isEmpty) {
      final Banque? found = banques
          .where((Banque b) => b.id == prospect.banqueId)
          .firstOrNull;
      if (found != null) {
        banque.text = found.name;
        banqueId = found.id;
      }
    }
    if (syndicatId == null && syndicat.text.isEmpty) {
      final Syndicat? found = syndicats
          .where((Syndicat s) => s.id == prospect.syndicatId)
          .firstOrNull;
      if (found != null) {
        syndicat.text = found.name;
        syndicatId = found.id;
      }
    }
    // La fiche locale ne porte pas de tranche de revenu : seule la durée du
    // système se reprend.
    dureeSystemeMois ??= kDureesSystemeMois.contains(prospect.dureeSystemeMois)
        ? prospect.dureeSystemeMois
        : null;
  }

  /// Le brouillon, tel qu'il se range et se relit. Les libellés des listes
  /// voyagent avec leur identifiant : sans eux, le champ se rouvrirait vide
  /// alors que le choix, lui, serait fait.
  Map<String, Object?> toDraft() => <String, Object?>{
    'nom': nom.text,
    'prenom': prenom.text,
    'email': email.text,
    'profession': profession.text,
    'duree': duree.text,
    'banque': banque.text,
    'banqueId': banqueId,
    'syndicat': syndicat.text,
    'syndicatId': syndicatId,
    'revenu': revenu.text,
    'incomeBandId': incomeBandId,
    'dureeSystemeMois': dureeSystemeMois,
    'whatsapp': whatsapp.text,
    'whatsappMemeNumero': whatsappMemeNumero.name,
    'fonctionnaire': fonctionnaire.name,
    'engagementEnCours': engagementEnCours.name,
    'champsLibres': reponsesLibres,
  };

  void applyDraft(Map<String, Object?> valeurs) {
    String texte(String cle) =>
        valeurs[cle] is String ? valeurs[cle]! as String : '';
    String? identifiant(String cle) =>
        valeurs[cle] is String ? valeurs[cle]! as String : null;

    nom.text = texte('nom');
    prenom.text = texte('prenom');
    email.text = texte('email');
    profession.text = texte('profession');
    duree.text = texte('duree');
    banque.text = texte('banque');
    banqueId = identifiant('banqueId');
    syndicat.text = texte('syndicat');
    syndicatId = identifiant('syndicatId');
    revenu.text = texte('revenu');
    incomeBandId = identifiant('incomeBandId');
    dureeSystemeMois = valeurs['dureeSystemeMois'] is num
        ? (valeurs['dureeSystemeMois']! as num).toInt()
        : null;
    whatsapp.text = texte('whatsapp');
    whatsappMemeNumero = _tri(valeurs['whatsappMemeNumero']);
    fonctionnaire = _tri(valeurs['fonctionnaire']);
    engagementEnCours = _tri(valeurs['engagementEnCours']);

    champsLibres
      ..clear()
      ..addAll(_reponses(valeurs['champsLibres']));
    // Les contrôleurs déjà nés portent encore le brouillon précédent : les
    // laisser tels quels rouvrirait la réponse d'une autre personne.
    for (final MapEntry<String, TextEditingController> entree
        in _libresTexte.entries) {
      entree.value.text = champsLibres[entree.key] ?? '';
    }
  }

  static Map<String, String> _reponses(Object? brut) {
    if (brut is! Map) return const <String, String>{};
    return <String, String>{
      for (final MapEntry<Object?, Object?> entree in brut.entries)
        if (entree.key is String && entree.value is String)
          entree.key! as String: entree.value! as String,
    };
  }

  static Tri _tri(Object? brut) =>
      Tri.values.where((Tri t) => t.name == brut).firstOrNull ?? Tri.nonDemande;

  void clear() {
    for (final TextEditingController c in _controllers) {
      c.clear();
    }
    for (final TextEditingController c in _libresTexte.values) {
      c.clear();
    }
    champsLibres.clear();
    banqueId = null;
    syndicatId = null;
    incomeBandId = null;
    dureeSystemeMois = null;
    whatsappMemeNumero = Tri.nonDemande;
    fonctionnaire = Tri.nonDemande;
    engagementEnCours = Tri.nonDemande;
  }

  void dispose() {
    for (final TextEditingController c in _controllers) {
      c.dispose();
    }
    for (final TextEditingController c in _libresTexte.values) {
      c.dispose();
    }
    for (final FocusNode f in _focusNodes) {
      f.dispose();
    }
  }

  List<TextEditingController> get _controllers => <TextEditingController>[
    nom,
    prenom,
    telephone,
    email,
    profession,
    duree,
    banque,
    syndicat,
    revenu,
    whatsapp,
  ];

  List<FocusNode> get _focusNodes => <FocusNode>[
    nomFocus,
    prenomFocus,
    emailFocus,
    professionFocus,
    dureeFocus,
    banqueFocus,
    syndicatFocus,
    revenuFocus,
    whatsappFocus,
  ];

  static void _fill(TextEditingController controller, String? value) {
    if (controller.text.isEmpty && value != null && value.isNotEmpty) {
      controller.text = value;
    }
  }

  static String? _texte(TextEditingController controller) {
    final String value = controller.text.trim();
    return value.isEmpty ? null : value;
  }
}

/// Oui, non, ou question non posée. `null` n'est PAS « non » : le serveur
/// distingue les deux, et douze mille fiches sont dans le troisième état.
///
/// [nonDemande] ne se PROPOSE plus : sur CHUES le dossier d'adhésion est
/// complet ou il n'y a pas d'adhésion. Il reste l'état de DÉPART, celui qui
/// part avec un appel qui n'a pas abouti.
enum Tri {
  oui('Oui', true),
  non('Non', false),
  nonDemande('Non demandé', null);

  const Tri(this.label, this.value);

  final String label;
  final bool? value;

  /// Les deux seules réponses offertes à l'écran.
  static const List<Tri> proposees = <Tri>[oui, non];
}

/// Les durées du système de paiement, en mois. Liste FERMÉE, la même que le web.
const List<int> kDureesSystemeMois = <int>[
  6,
  12,
  18,
  24,
  36,
  48,
  60,
  72,
  84,
  96,
  120,
  144,
  180,
  240,
  300,
];

String formatDureeMois(int mois) {
  if (mois % 12 != 0) return '$mois mois';
  final int ans = mois ~/ 12;
  return '$ans an${ans > 1 ? 's' : ''} ($mois mois)';
}

/// Étape 1 : le numéro, ce que la liste en dit, et la phrase sur la liste.
class _EtapeQui extends StatelessWidget {
  const _EtapeQui({
    required this.state,
    required this.controller,
    required this.focusNode,
    required this.onClear,
    required this.onNext,
    required this.verrouille,
  });

  final Phase2State state;
  final TextEditingController controller;
  final FocusNode focusNode;
  final VoidCallback onClear;
  final VoidCallback onNext;
  final bool verrouille;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      _PhoneBlock(
        controller: controller,
        focusNode: focusNode,
        // EB-08 : changer de numéro abandonnerait la fiche ouverte. Le champ se
        // rouvre dès que l'appel est consigné.
        enabled: !state.saving && !verrouille,
      ),
      const SizedBox(height: CpiSpacing.md),
      switch (state.stage) {
        Phase2Stage.notFound => _NotFound(
          phone: state.searchedPhone,
          onClear: onClear,
        ),
        Phase2Stage.horsPerimetre => _HorsPerimetre(
          phone: state.searchedPhone,
          onClear: onClear,
        ),
        Phase2Stage.alreadyClosed => _AlreadyClosed(
          entry: state.entry!,
          onNext: onNext,
        ),
        Phase2Stage.capture => _Trouve(
          entry: state.entry!,
          prospect: state.prospect,
        ),
        _ => _SearchHint(message: state.errorMessage),
      },
      const SizedBox(height: CpiSpacing.lg),
      const _PhraseListe(),
    ],
  );
}

/// Étapes 2 à 4 : ce que l'appel a appris de la personne, trois à cinq questions
/// à la fois. Une adhésion les exige toutes, sauf l'e-mail.
///
/// EB-27 : l'administration masque, exige et ordonne ces champs depuis le
/// panel. Le découpage en trois étapes, lui, reste celui du script d'appel :
/// l'ordre réglé se lit À L'INTÉRIEUR de l'étape qui porte la question.
class _EtapeRenseignements extends StatelessWidget {
  const _EtapeRenseignements({
    required this.etape,
    required this.fields,
    required this.banques,
    required this.syndicats,
    required this.tranches,
    required this.onChanged,
  });

  final int etape;
  final Phase2FormFields fields;
  final List<Banque> banques;
  final List<Syndicat> syndicats;
  final List<IncomeBand> tranches;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final Map<String, Widget> noeuds = switch (etape) {
      2 => _qui(),
      3 => _travail(),
      _ => _banqueEtSyndicat(),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: CpiSpacing.md,
      children: <Widget>[
        for (final String champ in fields.regles.ordonner(
          noeuds.keys.toList(growable: false),
        ))
          if (fields.regles.visible(champ, defaut: _visibleParDefaut(champ)))
            ?noeuds[champ],
        // Les champs ajoutés viennent après les questions du script, comme au
        // panel, sur la dernière étape de renseignements.
        if (etape == 4)
          for (final ChampLibreDto champ in fields.regles.libres)
            _ChampAjoute(champ: champ, fields: fields, onChanged: onChanged),
      ],
    );
  }

  bool _visibleParDefaut(String champ) =>
      champ == 'dureeSystemeMois' ? fields.montreDureeSysteme : true;

  Map<String, Widget> _qui() => <String, Widget>{
    'nom': CpiField(
      label: 'Nom',
      controller: fields.nom,
      focusNode: fields.nomFocus,
      hint: 'Ex. Sarr',
      textCapitalization: TextCapitalization.words,
      textInputAction: TextInputAction.next,
      maxLength: kProfessionMaxLength,
    ),
    'prenom': CpiField(
      label: 'Prénom',
      controller: fields.prenom,
      focusNode: fields.prenomFocus,
      hint: 'Ex. Fatou',
      textCapitalization: TextCapitalization.words,
      textInputAction: TextInputAction.next,
      maxLength: kProfessionMaxLength,
    ),
    // Le numéro vient de l'annuaire et ne se corrige pas depuis un appel :
    // le serveur refuse de l'écrire ici. Il est là pour être relu.
    'phoneE164': CpiField(
      label: 'Téléphone',
      controller: fields.telephone,
      readOnly: true,
      description: 'Numéro de l\'annuaire',
    ),
    'email': CpiField(
      label: 'E-mail',
      controller: fields.email,
      focusNode: fields.emailFocus,
      hint: 'Ex. awa.sy@exemple.sn',
      keyboardType: TextInputType.emailAddress,
      textInputAction: TextInputAction.next,
      maxLength: kCallAttemptEmailMaxLength,
      error: fields.erreurEmail,
    ),
  };

  Map<String, Widget> _travail() => <String, Widget>{
    'profession': LocalTypeahead(
      controller: fields.profession,
      focusNode: fields.professionFocus,
      label: 'Profession',
      hint: 'Ex. Instituteur',
      freeText: true,
      maxLength: kProfessionMaxLength,
      options: kProfessionsFrequentes
          .map((String m) => TypeaheadOption(id: m, label: m))
          .toList(growable: false),
      onSelected: (TypeaheadOption _) {},
    ),
    'dureeEtablissementMois': CpiField(
      label: 'Durée dans la fonction',
      controller: fields.duree,
      focusNode: fields.dureeFocus,
      hint: 'Ex. 36',
      keyboardType: TextInputType.number,
      textInputAction: TextInputAction.next,
      inputFormatters: <TextInputFormatter>[
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(3),
      ],
      suffix: const Text('mois'),
      error: fields.erreurDuree,
    ),
    'fonctionnaire': _ChoixTri(
      label: 'Fonctionnaire',
      value: fields.fonctionnaire,
      onChanged: (Tri choix) {
        fields.fonctionnaire = choix;
        onChanged();
      },
    ),
  };

  Map<String, Widget> _banqueEtSyndicat() => <String, Widget>{
    'syndicatId': LocalTypeahead(
      controller: fields.syndicat,
      focusNode: fields.syndicatFocus,
      label: 'Syndicat',
      hint: 'Ex. SAEMSS',
      selectedId: fields.syndicatId,
      emptyHint: syndicats.isEmpty
          ? 'La liste n\'est pas encore arrivée.'
          : 'Aucun résultat',
      options: syndicats
          .map(
            (Syndicat s) => TypeaheadOption(
              id: s.id,
              label: s.name,
              secondary: s.sigle,
              keywords: <String>[s.sigle, if (s.secteur != null) s.secteur!],
            ),
          )
          .toList(growable: false),
      onChanged: (String _) {
        if (fields.syndicatId == null) return;
        fields.syndicatId = null;
        onChanged();
      },
      onSelected: (TypeaheadOption o) {
        fields.syndicatId = o.id;
        onChanged();
      },
    ),
    'banqueId': LocalTypeahead(
      controller: fields.banque,
      focusNode: fields.banqueFocus,
      label: 'Banque',
      hint: 'Ex. BICIS',
      selectedId: fields.banqueId,
      emptyHint: banques.isEmpty
          ? 'La liste n\'est pas encore arrivée.'
          : 'Aucun résultat',
      options: banques
          .map(
            (Banque b) => TypeaheadOption(
              id: b.id,
              label: b.name,
              secondary: b.shortName,
              keywords: <String>[b.shortName],
            ),
          )
          .toList(growable: false),
      onChanged: (String _) {
        if (fields.banqueId == null) return;
        fields.banqueId = null;
        onChanged();
      },
      onSelected: (TypeaheadOption o) {
        fields.banqueId = o.id;
        onChanged();
      },
    ),
    'engagementEnCours': _ChoixTri(
      label: 'Engagement en cours à la banque',
      value: fields.engagementEnCours,
      onChanged: (Tri choix) {
        fields.engagementEnCours = choix;
        onChanged();
      },
    ),
    'incomeBandId': LocalTypeahead(
      controller: fields.revenu,
      focusNode: fields.revenuFocus,
      label: 'Revenu mensuel',
      hint: 'Ex. 150 000 à 300 000',
      selectedId: fields.incomeBandId,
      textInputAction: TextInputAction.done,
      emptyHint: tranches.isEmpty
          ? 'La liste n\'est pas encore arrivée.'
          : 'Aucun résultat',
      options: tranches
          .map(
            (IncomeBand t) => TypeaheadOption(
              id: t.id,
              label: t.label,
              keywords: <String>[t.code],
            ),
          )
          .toList(growable: false),
      onChanged: (String _) {
        if (fields.incomeBandId == null) return;
        fields.incomeBandId = null;
        onChanged();
      },
      onSelected: (TypeaheadOption o) {
        fields.incomeBandId = o.id;
        onChanged();
      },
    ),
    'dureeSystemeMois': CpiChoiceGroup<int>(
      label: 'Durée du système de paiement',
      value: fields.dureeSystemeMois,
      options: <CpiChoice<int>>[
        for (final int mois in kDureesSystemeMois)
          CpiChoice<int>(value: mois, label: formatDureeMois(mois)),
      ],
      onChanged: (int mois) {
        if (mois == fields.dureeSystemeMois) return;
        unawaited(HapticFeedback.selectionClick());
        fields.dureeSystemeMois = mois;
        onChanged();
      },
    ),
  };
}

/// Un champ que l'administration a ajouté au formulaire de conversion : une
/// saisie libre, ou un choix parmi les valeurs qu'elle a écrites.
class _ChampAjoute extends StatelessWidget {
  const _ChampAjoute({
    required this.champ,
    required this.fields,
    required this.onChanged,
  });

  final ChampLibreDto champ;
  final Phase2FormFields fields;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final String libelle = champ.obligatoire
        ? champ.libelle
        : '${champ.libelle} (facultatif)';

    if (champ.type == ChampLibreDtoTypeEnum.TEXTE) {
      return CpiField(
        label: libelle,
        controller: fields.libreTexte(champ.id),
        maxLength: kReponseChampLibreMaxLength,
      );
    }

    return CpiChoiceGroup<String>(
      label: libelle,
      value: fields.champsLibres[champ.id],
      options: <CpiChoice<String>>[
        for (final String valeur in ReglesConversion.valeursProposees(champ))
          CpiChoice<String>(value: valeur, label: valeur),
      ],
      onChanged: (String valeur) {
        if (valeur == fields.champsLibres[champ.id]) return;
        unawaited(HapticFeedback.selectionClick());
        fields.champsLibres[champ.id] = valeur;
        onChanged();
      },
    );
  }
}

/// Le serveur tronque au-delà (`REPONSE_MAX_LENGTH`, catalogue.ts).
const int kReponseChampLibreMaxLength = 500;

/// Une question à deux réponses : oui ou non.
class _ChoixTri extends StatelessWidget {
  const _ChoixTri({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final Tri value;
  final ValueChanged<Tri> onChanged;

  @override
  Widget build(BuildContext context) => CpiChoiceGroup<Tri>(
    label: label,
    value: value,
    options: <CpiChoice<Tri>>[
      for (final Tri choix in Tri.proposees)
        CpiChoice<Tri>(value: choix, label: choix.label),
    ],
    onChanged: (Tri choix) {
      if (choix == value) return;
      unawaited(HapticFeedback.selectionClick());
      onChanged(choix);
    },
  );
}

/// Le pied des étapes de renseignements : le dossier d'adhésion se remplit en
/// entier, et le bouton nomme ce qui manque. La seconde action est la sortie de
/// l'appel qui n'a pas abouti : elle, n'attend rien.
class _EtapeAction extends StatelessWidget {
  const _EtapeAction({
    required this.manque,
    required this.onContinue,
    required this.onNegative,
  });

  final String? manque;
  final VoidCallback onContinue;
  final VoidCallback? onNegative;

  @override
  Widget build(BuildContext context) => CpiActionBar(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        CpiButton(
          'Continuer',
          icon: PhosphorIconsRegular.arrowRight,
          subtitle: manque,
          onPressed: manque == null ? onContinue : null,
        ),
        const SizedBox(height: CpiSpacing.xs),
        CpiButton(
          'L\'appel n\'a pas abouti',
          variant: CpiButtonVariant.ghost,
          icon: PhosphorIconsRegular.phoneX,
          onPressed: onNegative,
        ),
      ],
    ),
  );
}

/// Dernière étape : ce que l'appel a donné, ou sa confirmation.
class _EtapeResultat extends StatelessWidget {
  const _EtapeResultat({
    required this.state,
    required this.comment,
    required this.recap,
    required this.onRendezVous,
    required this.recording,
    required this.noteOuverte,
    required this.onOuvrirNote,
    required this.onMethod,
    required this.onNegative,
    required this.onRecordingChanged,
    required this.onRecordingStateChanged,
    required this.onNext,
  });

  final Phase2State state;
  final TextEditingController comment;
  final List<CpiRecapLine> recap;
  final VoidCallback onRendezVous;
  final bool recording;
  final bool noteOuverte;
  final VoidCallback onOuvrirNote;
  final ValueChanged<String> onMethod;
  final VoidCallback onNegative;
  final ValueChanged<String?> onRecordingChanged;
  final ValueChanged<String?> onRecordingStateChanged;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    if (state.stage == Phase2Stage.confirmed) {
      return _Confirmed(label: state.confirmation, onNext: onNext);
    }
    return _Capture(
      state: state,
      comment: comment,
      recap: recap,
      recording: recording,
      noteOuverte: noteOuverte,
      onOuvrirNote: onOuvrirNote,
      onRecordingChanged: onRecordingChanged,
      onRecordingStateChanged: onRecordingStateChanged,
      onMethod: onMethod,
      onRendezVous: onRendezVous,
      onNegative: onNegative,
    );
  }
}

/// Le pied de l'étape 1 : recevoir la liste tant qu'elle manque, sinon
/// continuer vers le résultat. Les états qui portent déjà leurs propres
/// boutons — numéro absent, dossier clos — n'en reçoivent aucun.
class _EtapeUnAction extends ConsumerWidget {
  const _EtapeUnAction({required this.onContinue});

  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int directory = ref.watch(phase2DirectoryCountProvider).value ?? 0;
    final Phase2State phase2 = ref.watch(phase2ControllerProvider);

    // Le numéro déjà retrouvé passe avant l'état de la liste : sinon l'écran
    // proposait un téléchargement au lieu de continuer sur un dossier ouvert.
    if (directory == 0 && phase2.stage != Phase2Stage.capture) {
      return CpiActionBar(
        child: CpiButton(
          'Recevoir la liste des numéros',
          icon: PhosphorIconsRegular.cloudArrowDown,
          loading: phase2.downloading,
          onPressed: () {
            unawaited(HapticFeedback.selectionClick());
            unawaited(ref.read(phase2ControllerProvider.notifier).download());
          },
        ),
      );
    }
    if (phase2.stage == Phase2Stage.notFound ||
        phase2.stage == Phase2Stage.horsPerimetre ||
        phase2.stage == Phase2Stage.alreadyClosed) {
      // Pas de barre, mais la place de la barre de gestes : `CpiScaffold` rend
      // le bas du corps au pied dès qu'il en reçoit un.
      return SizedBox(height: MediaQuery.viewPaddingOf(context).bottom);
    }
    final bool pret = phase2.stage == Phase2Stage.capture;
    return CpiActionBar(
      child: CpiButton(
        'Continuer',
        icon: PhosphorIconsRegular.arrowRight,
        subtitle: 'Tapez d\'abord le numéro appelé',
        onPressed: pret ? onContinue : null,
      ),
    );
  }
}

/// Le motif qui ferme sur une méthode obtenue. Le serveur en garantit un seul,
/// et le repli système le porte tant que la table locale est vide.
CallReason methodReasonOf(List<CallReason> reasons) => reasons.firstWhere(
  (CallReason r) => r.effect == CallEffects.closeMethod,
  orElse: () => SystemCallReasons.byCode[CallOutcomes.methodObtained]!,
);

/// La seule phrase gardée sur l'état de la liste des numéros : d'où elle vient
/// et de quand elle date. Les compteurs de la journée sont dans Réglages.
class _PhraseListe extends ConsumerWidget {
  const _PhraseListe();

  static final NumberFormat _number = NumberFormat.decimalPattern('fr');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final Phase2State phase2 = ref.watch(phase2ControllerProvider);
    final int directory = ref.watch(phase2DirectoryCountProvider).value ?? 0;
    final DateTime? lastPulledAt = ref
        .watch(phase2DirectoryStateProvider)
        .value
        ?.lastPulledAt;

    if (phase2.downloading) {
      return Semantics(
        liveRegion: true,
        label: 'Téléchargement : ${phase2.downloaded} numéros.',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            const FProgress(),
            const SizedBox(height: CpiSpacing.xxs),
            Text(
              '${_number.format(phase2.downloaded)} numéros',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      );
    }

    // Un dossier déjà trouvé prime sur l'état de la liste : annoncer les deux
    // en même temps disait « c'est bon » et « il manque tout » sur un écran.
    if (directory == 0 && phase2.stage != Phase2Stage.capture) {
      return Text(
        'La liste des numéros n\'est pas encore sur ce téléphone.',
        style: theme.textTheme.bodySmall?.copyWith(color: cpi.accentText),
      );
    }
    if (directory == 0) return const SizedBox.shrink();

    final DateTime? when = lastPulledAt;
    final String freshness = when == null
        ? 'jamais reçue'
        : 'reçue ${relativeTime(when)}';
    return Text(
      'Liste de ${_number.format(directory)} numéros · $freshness',
      style: theme.textTheme.bodySmall?.copyWith(
        color: theme.colorScheme.onSurfaceVariant,
      ),
    );
  }
}

class _PhoneBlock extends ConsumerWidget {
  const _PhoneBlock({
    required this.controller,
    required this.focusNode,
    required this.enabled,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String? downloadError = ref
        .watch(phase2ControllerProvider)
        .downloadError;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Semantics(
          textField: true,
          label: 'Numéro appelé, neuf chiffres',
          hint: 'La recherche se lance dès que le numéro est complet.',
          child: ExcludeSemantics(
            child: PhoneField(
              controller: controller,
              focusNode: focusNode,
              autofocus: true,
              enabled: enabled,
              label: 'Numéro appelé',
              textInputAction: TextInputAction.done,
              helper: 'Recherche automatique',
            ),
          ),
        ),
        if (downloadError != null)
          Padding(
            padding: const EdgeInsets.only(top: CpiSpacing.xs),
            child: _Notice(
              icon: PhosphorIconsRegular.warningCircle,
              message: downloadError,
            ),
          ),
      ],
    );
  }
}

class _SearchHint extends StatelessWidget {
  const _SearchHint({this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    if (message != null) {
      return _Notice(
        icon: PhosphorIconsRegular.warningCircle,
        message: message!,
      );
    }
    return Column(
      children: <Widget>[
        const SizedBox(height: CpiSpacing.xxl),
        Icon(
          PhosphorIconsDuotone.phoneList,
          size: CpiIconSize.display,
          color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
        ),
      ],
    );
  }
}

/// Le numéro est dans la liste et le dossier est ouvert : l'étape 1 le confirme
/// avant de laisser passer à l'étape 2.
/// La fiche telle qu'elle est, avant de dérouler le script : qui c'est, ce que
/// le dernier appel a donné, combien de fois on a déjà essayé.
class _Trouve extends ConsumerWidget {
  const _Trouve({required this.entry, this.prospect});

  final Phase2DirectoryData entry;

  /// Nulle si le pull n'a pas encore descendu la fiche : l'annuaire seul ne
  /// porte qu'un numéro et un état.
  final Prospect? prospect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final Prospect? fiche = prospect;
    final String nom = fiche == null
        ? ''
        : '${fiche.prenom} ${fiche.nom}'.trim();
    final DateTime? dernier = fiche?.lastCallAt;
    final String? issue = fiche?.lastCallOutcome;
    final int tentatives = fiche?.callAttemptCount ?? 0;
    final String statut = Phase2Controller.labelForStatus(entry.phase2Status);
    final PreuvesAppelData? preuve = ref
        .watch(dernierePreuveProvider((kind: 'prospect', id: entry.prospectId)))
        .value;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Semantics(
          label:
              'Numéro trouvé : ${Phone.format(entry.phoneE164)}. '
              '${nom.isEmpty ? '' : '$nom. '}Statut : $statut.',
          child: ExcludeSemantics(
            child: CpiCard(
              child: Row(
                spacing: CpiSpacing.sm,
                children: <Widget>[
                  Icon(
                    PhosphorIconsFill.checkCircle,
                    size: CpiIconSize.xl,
                    color: cpi.success,
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text(
                          nom.isEmpty ? Phone.format(entry.phoneE164) : nom,
                          style: theme.textTheme.titleMedium,
                        ),
                        Text(
                          nom.isEmpty
                              ? 'Numéro trouvé.'
                              : Phone.format(entry.phoneE164),
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  CpiTag(statut),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: CpiSpacing.sm),
        CpiCard.rows(<CpiRow>[
          if (preuve != null)
            CpiRow(title: 'Téléphone', subtitle: preuve.libelle),
          if (fiche?.whatsappE164 != null)
            CpiRow(
              title: 'WhatsApp',
              subtitle: Phone.format(fiche!.whatsappE164!),
            ),
          if ((fiche?.profession ?? '').trim().isNotEmpty)
            CpiRow(title: 'Profession', subtitle: fiche!.profession!.trim()),
          CpiRow(
            title: 'Dernière interaction',
            subtitle: dernier == null ? 'Jamais appelé' : relativeTime(dernier),
          ),
          if (issue != null)
            CpiRow(
              title: 'Résultat',
              subtitle: SystemCallReasons.byCode[issue]?.label ?? issue,
            ),
          CpiRow(
            title: 'Tentatives',
            subtitle: switch (tentatives) {
              0 => 'Aucun appel',
              1 => '1 appel',
              _ => '$tentatives appels',
            },
          ),
        ]),
      ],
    );
  }
}

class _NotFound extends ConsumerWidget {
  const _NotFound({required this.phone, required this.onClear});

  final String? phone;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final bool downloading = ref.watch(phase2ControllerProvider).downloading;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const _Notice(
          icon: PhosphorIconsRegular.magnifyingGlass,
          message: 'Ce numéro n\'est pas dans la liste.',
        ),
        const SizedBox(height: CpiSpacing.xs),
        if (phone != null)
          Text(
            Phone.format(phone!),
            textAlign: TextAlign.center,
            style: theme.textTheme.titleMedium,
          ),
        const SizedBox(height: CpiSpacing.md),
        CpiButton(
          'Effacer et recommencer',
          variant: CpiButtonVariant.secondary,
          icon: PhosphorIconsRegular.eraser,
          onPressed: onClear,
        ),
        const SizedBox(height: CpiSpacing.xs),
        CpiButton(
          'Mettre la liste à jour',
          variant: CpiButtonVariant.ghost,
          icon: PhosphorIconsRegular.cloudArrowDown,
          loading: downloading,
          onPressed: () =>
              unawaited(ref.read(phase2ControllerProvider.notifier).download()),
        ),
      ],
    );
  }
}

/// Le numéro existe, mais aucune campagne ne me l'attribue. Sans cet état,
/// l'appel se saisissait en entier avant que le serveur ne le refuse
/// (`PHASE2_NOT_ASSIGNED`), des heures plus tard, dans « À corriger ».
class _HorsPerimetre extends StatelessWidget {
  const _HorsPerimetre({required this.phone, required this.onClear});

  final String? phone;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      const _Notice(
        icon: PhosphorIconsRegular.prohibit,
        message: 'Ce numéro n\'est pas dans vos campagnes.',
      ),
      const SizedBox(height: CpiSpacing.xs),
      if (phone != null)
        Text(
          Phone.format(phone!),
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium,
        ),
      const SizedBox(height: CpiSpacing.md),
      CpiButton(
        'Effacer et recommencer',
        variant: CpiButtonVariant.secondary,
        icon: PhosphorIconsRegular.eraser,
        onPressed: onClear,
      ),
    ],
  );
}

class _AlreadyClosed extends StatelessWidget {
  const _AlreadyClosed({required this.entry, required this.onNext});

  final Phase2DirectoryData entry;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final bool obtained = entry.phase2Status == Phase2Statuses.methodObtained;
    final Color tone = obtained ? cpi.success : cpi.info;

    return Semantics(
      label:
          'Déjà traité : ${Phase2Controller.labelForStatus(entry.phase2Status)}.'
          '${obtained && entry.enrollmentMethod != null ? ' Méthode ${Phase2Controller.labelForMethod(entry.enrollmentMethod!)}.' : ''} '
          'Lecture seule.',
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            CpiCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Icon(
                        obtained
                            ? PhosphorIconsFill.checkCircle
                            : PhosphorIconsFill.prohibit,
                        size: CpiIconSize.lg,
                        color: tone,
                      ),
                      const SizedBox(width: CpiSpacing.xs),
                      Expanded(
                        child: Text(
                          'Déjà traité',
                          style: theme.textTheme.titleMedium,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: CpiSpacing.xs),
                  Text(
                    Phase2Controller.labelForStatus(entry.phase2Status),
                    style: theme.textTheme.headlineSmall,
                  ),
                  if (entry.enrollmentMethod != null) ...<Widget>[
                    const SizedBox(height: CpiSpacing.xxs),
                    Text(
                      'Méthode : '
                      '${Phase2Controller.labelForMethod(entry.enrollmentMethod!)}',
                      style: theme.textTheme.bodyMedium,
                    ),
                  ],
                  const SizedBox(height: CpiSpacing.xs),
                  Text(
                    Phone.format(entry.phoneE164),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: CpiSpacing.sm),
            const _Notice(
              icon: PhosphorIconsRegular.lockSimple,
              message: 'Seul un responsable peut le rouvrir.',
              danger: false,
            ),
            const SizedBox(height: CpiSpacing.md),
            CpiButton(
              'Numéro suivant',
              icon: PhosphorIconsRegular.arrowRight,
              onPressed: onNext,
            ),
          ],
        ),
      ),
    );
  }
}

class _Capture extends StatelessWidget {
  const _Capture({
    required this.state,
    required this.comment,
    required this.recap,
    required this.recording,
    required this.noteOuverte,
    required this.onOuvrirNote,
    required this.onMethod,
    required this.onRendezVous,
    required this.onNegative,
    required this.onRecordingChanged,
    required this.onRecordingStateChanged,
  });

  final Phase2State state;
  final TextEditingController comment;
  final List<CpiRecapLine> recap;
  final bool recording;
  final bool noteOuverte;
  final VoidCallback onOuvrirNote;
  final ValueChanged<String> onMethod;
  final VoidCallback onRendezVous;
  final VoidCallback onNegative;
  final ValueChanged<String?> onRecordingChanged;
  final ValueChanged<String?> onRecordingStateChanged;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool enabled = !state.saving && !recording;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        // Ce qui a été recueilli aux trois étapes précédentes, relu avant la
        // seule décision qui ferme le dossier.
        CpiRecap(lines: recap, title: 'L\'appel'),
        const SizedBox(height: CpiSpacing.md),
        CpiField(
          label: 'Commentaire',
          controller: comment,
          hint: 'En une phrase',
          maxLines: 3,
          maxLength: kCallAttemptCommentMaxLength,
          textCapitalization: TextCapitalization.sentences,
          enabled: enabled,
        ),
        const SizedBox(height: CpiSpacing.md),
        Text(
          'Une seule réponse.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: CpiSpacing.sm),
        _MethodCard(
          method: EnrollmentMethods.appointment,
          title: 'RDV CPI',
          subtitle: 'Choisir la date et l\'heure',
          icon: PhosphorIconsRegular.calendarPlus,
          enabled: enabled,
          onTap: (String _) => onRendezVous(),
        ),
        const SizedBox(height: CpiSpacing.sm),
        _MethodCard(
          method: EnrollmentMethods.platform,
          title: 'Plateforme en ligne',
          subtitle: 'Il remplit le formulaire CPI CHUES',
          icon: PhosphorIconsRegular.deviceMobile,
          enabled: enabled,
          onTap: onMethod,
        ),
        const SizedBox(height: CpiSpacing.sm),
        _MethodCard(
          method: EnrollmentMethods.voiceOrElectronicMessaging,
          title: 'Mail',
          subtitle: 'Il envoie ses informations par e-mail',
          icon: PhosphorIconsRegular.envelopeSimple,
          enabled: enabled,
          onTap: onMethod,
        ),
        const SizedBox(height: CpiSpacing.sm),
        _MethodCard(
          method: EnrollmentMethods.whatsapp,
          title: 'WhatsApp',
          subtitle: 'Il écrit au numéro CPI CHUES',
          icon: PhosphorIconsRegular.whatsappLogo,
          enabled: enabled,
          onTap: onMethod,
        ),
        const SizedBox(height: CpiSpacing.md),
        CpiButton(
          'L\'appel n\'a pas abouti',
          variant: CpiButtonVariant.secondary,
          icon: PhosphorIconsRegular.phoneX,
          onPressed: enabled ? onNegative : null,
        ),
        const SizedBox(height: CpiSpacing.md),
        if (noteOuverte)
          CallAudioRecorder(
            enabled: !state.saving,
            onChanged: onRecordingChanged,
            onRecordingStateChanged: onRecordingStateChanged,
          )
        else
          CpiButton(
            'Ajouter une note vocale',
            variant: CpiButtonVariant.ghost,
            icon: PhosphorIconsRegular.microphone,
            onPressed: state.saving ? null : onOuvrirNote,
          ),
        if (state.errorMessage != null) ...<Widget>[
          const SizedBox(height: CpiSpacing.sm),
          _Notice(
            icon: PhosphorIconsRegular.warningCircle,
            message: state.errorMessage!,
          ),
        ],
      ],
    );
  }
}

class _MethodCard extends StatelessWidget {
  const _MethodCard({
    required this.method,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final String method;
  final String title;
  final String subtitle;
  final IconData icon;
  final bool enabled;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    void choose() {
      unawaited(HapticFeedback.selectionClick());
      onTap(method);
    }

    return Semantics(
      button: true,
      enabled: enabled,
      onTap: enabled ? choose : null,
      label: 'Méthode obtenue : $title. $subtitle',
      child: ExcludeSemantics(
        child: CpiCard(
          onTap: enabled ? choose : null,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: kCpiMinTouchTarget),
            child: Row(
              spacing: CpiSpacing.sm,
              children: <Widget>[
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surfaceContainerHigh,
                    shape: BoxShape.circle,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(CpiSpacing.sm),
                    child: Icon(
                      icon,
                      size: CpiIconSize.xl,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(title, style: theme.textTheme.titleMedium),
                      Text(
                        subtitle,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  PhosphorIconsRegular.caretRight,
                  size: CpiIconSize.md,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Confirmed extends StatelessWidget {
  const _Confirmed({required this.label, required this.onNext});

  final String? label;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    return Semantics(
      liveRegion: true,
      label: 'Enregistré : ${label ?? ''}.',
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            CpiCard(
              child: Row(
                spacing: CpiSpacing.sm,
                children: <Widget>[
                  _SpringIn(
                    child: Icon(
                      PhosphorIconsFill.checkCircle,
                      size: CpiIconSize.xxl,
                      color: cpi.success,
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text('Enregistré', style: theme.textTheme.titleMedium),
                        if (label != null)
                          Text(label!, style: theme.textTheme.bodyMedium),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: CpiSpacing.md),
            CpiButton(
              'Numéro suivant',
              icon: PhosphorIconsRegular.arrowRight,
              onPressed: onNext,
            ),
          ],
        ),
      ),
    );
  }
}

/// Le contenu de la feuille « RDV CPI » : un jour au calendrier,
/// une heure à la roue, et rien d'autre.
///
/// Le serveur EXIGE la date sur cette méthode et la refuse sur les autres :
/// la feuille ne rend donc jamais un rendez-vous vide, elle se ferme sur
/// « Annuler » ou sur un instant complet.
///
/// Publique comme [CallOutcomeSheet] : le balayage de débordement la peint
/// directement, une feuille modale n'étant pas atteignable par construction.
class RendezVousSheet extends StatefulWidget {
  const RendezVousSheet({required this.now, super.key});

  final DateTime now;

  @override
  State<RendezVousSheet> createState() => _RendezVousSheetState();
}

class _RendezVousSheetState extends State<RendezVousSheet> {
  late final DateTime _aujourdhui = DateTime.utc(
    widget.now.toUtc().year,
    widget.now.toUtc().month,
    widget.now.toUtc().day,
  );

  late DateTime _jour = _aujourdhui;
  FTime _heure = const FTime(9, 0);

  /// Le jour se choisit à la roue plutôt qu'à la puce.
  bool _roulette = false;
  int _index = 0;

  /// Tenu ici et non par la roue : c'est ce qui permet de la déplacer sans
  /// glisser, depuis le lecteur d'écran.
  final FPickerController _roue = FPickerController(indexes: <int>[0]);

  /// Deux mois : au-delà, un rendez-vous de conversion ne se prend pas au
  /// téléphone.
  static const int _horizonJours = 60;

  static const List<(int, String)> _joursProches = <(int, String)>[
    (0, 'Aujourd\'hui'),
    (1, 'Demain'),
    (2, 'Après-demain'),
  ];

  static final DateFormat _jourLong = DateFormat('EEEE d MMMM yyyy', 'fr');
  static final DateFormat _jourCourt = DateFormat('EEE d MMMM', 'fr');

  @override
  void dispose() {
    _roue.dispose();
    super.dispose();
  }

  DateTime _jourDe(int offset) =>
      _aujourdhui.add(Duration(days: offset.clamp(0, _horizonJours - 1)));

  void _choisirJour(DateTime jour, {int? index}) {
    unawaited(HapticFeedback.selectionClick());
    setState(() {
      _jour = jour;
      _roulette = index != null;
      if (index != null) _index = index;
    });
  }

  void _ouvrirLaRoulette() {
    if (_roulette) {
      _choisirJour(_aujourdhui);
      return;
    }
    _roue.value = <int>[_index];
    _choisirJour(_jourDe(_index), index: _index);
  }

  void _glisserVers(int index) {
    if (index < 0 || index >= _horizonJours) return;
    _choisirJour(_jourDe(index), index: index);
    unawaited(_roue.animateTo(<int>[index]));
  }

  static String _deuxChiffres(int value) => value.toString().padLeft(2, '0');

  String get _heureTexte =>
      '${_deuxChiffres(_heure.hour)}:${_deuxChiffres(_heure.minute)}';

  FTime _decalee(int minutes) {
    const int jour = 24 * 60;
    final int total =
        (_heure.hour * 60 + _heure.minute + minutes + jour) % jour;
    return FTime(total ~/ 60, total % 60);
  }

  DateTime get _instant => DateTime.utc(
    _jour.year,
    _jour.month,
    _jour.day,
    _heure.hour,
    _heure.minute,
  );

  /// Africa/Dakar est sur UTC+0 toute l'année : l'heure murale se construit
  /// donc directement en UTC, comme pour les rappels.
  bool get _passe =>
      _instant.isBefore(widget.now.toUtc().subtract(kRendezVousSkew));

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) {
      final ThemeData theme = Theme.of(context);
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text('Quel jour ?', style: theme.textTheme.titleSmall),
          const SizedBox(height: CpiSpacing.xs),
          // Des puces et une roue, comme pour l'heure d'un rappel, et non le
          // calendrier de ForUI : son en-tête est enfermé dans une grille de
          // sept tuiles de largeur fixe, et il déborde dès « Grand ».
          Wrap(
            spacing: CpiSpacing.xs,
            runSpacing: CpiSpacing.xs,
            children: <Widget>[
              for (final (int offset, String label) in _joursProches)
                CallbackPill(
                  label: label,
                  selected: !_roulette && _jour == _jourDe(offset),
                  onPress: () => _choisirJour(_jourDe(offset)),
                ),
              CallbackPill(
                label: 'Un autre jour',
                icon: PhosphorIconsRegular.calendarBlank,
                selected: _roulette,
                onPress: _ouvrirLaRoulette,
              ),
            ],
          ),
          if (_roulette) ...<Widget>[
            const SizedBox(height: CpiSpacing.xs),
            Semantics(
              container: true,
              label: 'Jour du rendez-vous',
              value: _jourLong.format(_jour),
              increasedValue: _jourLong.format(_jourDe(_index + 1)),
              decreasedValue: _jourLong.format(_jourDe(_index - 1)),
              onIncrease: () => _glisserVers(_index + 1),
              onDecrease: () => _glisserVers(_index - 1),
              excludeSemantics: true,
              child: SizedBox(
                height:
                    MediaQuery.textScalerOf(context).scale(CpiSpacing.huge) * 3,
                child: FPicker(
                  control: FPickerControl.managed(
                    controller: _roue,
                    onChange: (List<int> indexes) => _choisirJour(
                      _jourDe(indexes.first),
                      index: indexes.first,
                    ),
                  ),
                  children: <Widget>[
                    FPickerWheel(
                      children: <Widget>[
                        for (int i = 0; i < _horizonJours; i++)
                          Text(
                            _jourCourt.format(_jourDe(i)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: CpiSpacing.md),
          Text('À quelle heure ?', style: theme.textTheme.titleSmall),
          const SizedBox(height: CpiSpacing.xs),
          // La roue ne se règle qu'au glissé, geste qu'un lecteur d'écran ne
          // produit pas : elle porte son nom, sa valeur et de quoi passer d'une
          // minute à l'autre sans glisser.
          Semantics(
            container: true,
            label: 'Heure du rendez-vous',
            value: _heureTexte,
            increasedValue:
                '${_deuxChiffres(_decalee(1).hour)}:'
                '${_deuxChiffres(_decalee(1).minute)}',
            decreasedValue:
                '${_deuxChiffres(_decalee(-1).hour)}:'
                '${_deuxChiffres(_decalee(-1).minute)}',
            onIncrease: () => setState(() => _heure = _decalee(1)),
            onDecrease: () => setState(() => _heure = _decalee(-1)),
            excludeSemantics: true,
            child: SizedBox(
              // `ListWheelScrollView` prend toute la hauteur qu'on lui donne :
              // dans une feuille qui se dimensionne sur son contenu, il n'en
              // reçoit aucune.
              height:
                  MediaQuery.textScalerOf(context).scale(CpiSpacing.huge) * 3,
              child: FTimePicker(
                hour24: true,
                control: FTimePickerControl.lifted(
                  time: _heure,
                  onChange: (FTime heure) => setState(() => _heure = heure),
                ),
              ),
            ),
          ),
          const SizedBox(height: CpiSpacing.md),
          Semantics(
            liveRegion: true,
            child: Text(
              '${_jourLong.format(_jour)} à $_heureTexte',
              style: theme.textTheme.titleMedium,
            ),
          ),
          if (_passe) ...<Widget>[
            const SizedBox(height: CpiSpacing.sm),
            const _Notice(
              icon: PhosphorIconsRegular.warningCircle,
              message: 'Ce rendez-vous est déjà passé.',
              live: true,
            ),
          ],
          const SizedBox(height: CpiSpacing.md),
          CpiButton(
            'Enregistrer le rendez-vous',
            icon: PhosphorIconsRegular.calendarCheck,
            subtitle: 'Choisissez une date à venir',
            onPressed: _passe
                ? null
                : () => Navigator.of(context).pop(_instant),
          ),
          const SizedBox(height: CpiSpacing.xs),
          CpiButton(
            'Annuler',
            variant: CpiButtonVariant.ghost,
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      );
    },
  );
}

class CallOutcomeChoice {
  const CallOutcomeChoice(this.reason, this.comment, this.callbackAt);

  final CallReason reason;
  final String? comment;
  final DateTime? callbackAt;
}

/// Le contenu de la feuille des issues autres qu'une méthode obtenue.
///
/// Elle ne cite aucun motif : elle rend ce que porte la table locale, groupé par
/// EFFET, parce que c'est l'effet qui dit au téléconseiller ce que sa réponse
/// fait au dossier, et trié par l'ordre que l'équipe du client a choisi.
///
/// La coque — poignée, titre, défilement — vient de `showCpiSheet`.
class CallOutcomeSheet extends StatefulWidget {
  const CallOutcomeSheet({required this.now, required this.reasons, super.key});

  final DateTime now;
  final List<CallReason> reasons;

  @override
  State<CallOutcomeSheet> createState() => _CallOutcomeSheetState();
}

class _CallOutcomeSheetState extends State<CallOutcomeSheet> {
  final TextEditingController _comment = TextEditingController();
  CallReason? _reason;
  String? _error;
  DateTime? _callbackAt;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  static const List<String> _effectOrder = <String>[
    CallEffects.keepOpen,
    CallEffects.scheduleCallback,
    CallEffects.closeRefused,
    CallEffects.closeWrongNumber,
  ];

  static const Map<String, String> _effectHeader = <String, String>{
    CallEffects.keepOpen: 'Le dossier reste ouvert',
    CallEffects.scheduleCallback: 'Un rappel est à programmer',
    CallEffects.closeRefused: 'Refus, le dossier se ferme',
    CallEffects.closeWrongNumber: 'Numéro hors service, le dossier se ferme',
  };

  List<({String header, List<CallReason> items})> _groups() {
    final List<CallReason> sorted =
        widget.reasons
            .where((CallReason r) => r.effect != CallEffects.closeMethod)
            .toList()
          ..sort(
            (CallReason a, CallReason b) => a.sortOrder.compareTo(b.sortOrder),
          );

    final Map<String, List<CallReason>> byEffect = <String, List<CallReason>>{};
    for (final CallReason r in sorted) {
      byEffect.putIfAbsent(r.effect, () => <CallReason>[]).add(r);
    }
    // Un effet que cette version ignore passe en fin de liste plutôt que d'être
    // écarté : un motif invisible est exactement le défaut qu'on corrige.
    final List<String> effects = <String>[
      ..._effectOrder.where(byEffect.containsKey),
      ...byEffect.keys.where((String e) => !_effectOrder.contains(e)),
    ];
    return <({String header, List<CallReason> items})>[
      for (final String effect in effects)
        (
          header: _effectHeader[effect] ?? 'Autres motifs',
          items: byEffect[effect]!,
        ),
    ];
  }

  bool get _needsComment => _reason?.requiresComment ?? false;

  void _choisir(CallReason reason) {
    unawaited(HapticFeedback.selectionClick());
    setState(() {
      // L'heure ne se remet à zéro que si le sélecteur disparaît : entre deux
      // motifs qui programment tous deux un rappel il n'est pas démonté, sa
      // puce restait allumée sur une heure qui venait d'être effacée.
      if (_reason?.effect != reason.effect) _callbackAt = null;
      _reason = reason;
      _error = null;
    });
  }

  void _submit() {
    final CallReason? reason = _reason;
    if (reason == null) {
      setState(() => _error = 'Choisissez une issue.');
      return;
    }
    final String? comment = WriteRepository.normalizeComment(_comment.text);
    final CallAttemptProblem? problem = WriteRepository.validateCallAttempt(
      reason: reason,
      comment: comment,
    );
    if (problem != null) {
      unawaited(HapticFeedback.heavyImpact());
      setState(() => _error = problem.message);
      return;
    }
    Navigator.of(context).pop(CallOutcomeChoice(reason, comment, _callbackAt));
  }

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) {
      final ThemeData theme = Theme.of(context);

      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            'Pourquoi l\'appel n\'a pas abouti à une méthode.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          for (final ({String header, List<CallReason> items}) group
              in _groups()) ...<Widget>[
            const SizedBox(height: CpiSpacing.md),
            _GroupeDIssues(
              header: group.header,
              items: group.items,
              selected: _reason,
              onChanged: _choisir,
            ),
          ],
          if (_reason?.effect == CallEffects.scheduleCallback) ...<Widget>[
            const SizedBox(height: CpiSpacing.md),
            CallbackPicker(
              key: const ValueKey<String>('callback-picker'),
              now: widget.now,
              onChanged: (DateTime? at) => _callbackAt = at,
            ),
          ],
          const SizedBox(height: CpiSpacing.md),
          CpiField(
            label: _needsComment
                ? 'Commentaire (obligatoire)'
                : 'Commentaire (facultatif)',
            controller: _comment,
            hint: 'En une phrase',
            maxLines: 3,
            maxLength: kCallAttemptCommentMaxLength,
            textCapitalization: TextCapitalization.sentences,
            onChanged: (String _) {
              if (_error != null) setState(() => _error = null);
            },
          ),
          if (_error != null) ...<Widget>[
            const SizedBox(height: CpiSpacing.sm),
            _Notice(
              icon: PhosphorIconsRegular.warningCircle,
              message: _error!,
              live: true,
            ),
          ],
          const SizedBox(height: CpiSpacing.md),
          CpiButton(
            'Enregistrer',
            icon: PhosphorIconsRegular.floppyDisk,
            onPressed: _submit,
          ),
          const SizedBox(height: CpiSpacing.xs),
          CpiButton(
            'Annuler',
            variant: CpiButtonVariant.ghost,
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      );
    },
  );
}

/// Les motifs d'un même effet, sous l'intitulé qui dit ce qu'ils font au
/// dossier.
///
/// Chaque groupe porte sa propre sélection remontée à l'écran : choisir dans un
/// groupe éteint donc les autres, sans qu'aucun ait à se connaître.
class _GroupeDIssues extends StatelessWidget {
  const _GroupeDIssues({
    required this.header,
    required this.items,
    required this.selected,
    required this.onChanged,
  });

  final String header;
  final List<CallReason> items;
  final CallReason? selected;
  final ValueChanged<CallReason> onChanged;

  static IconData _icon(String effect) => switch (effect) {
    CallEffects.scheduleCallback => PhosphorIconsRegular.clockCountdown,
    CallEffects.closeRefused => PhosphorIconsRegular.prohibit,
    CallEffects.closeWrongNumber => PhosphorIconsRegular.warningCircle,
    CallEffects.keepOpen => PhosphorIconsRegular.phoneSlash,
    _ => PhosphorIconsRegular.dotsThreeCircle,
  };

  /// La couleur choisie par l'équipe du client, en `#RRGGBB`. Illisible ou
  /// absente, la puce reprend celle du thème plutôt que de disparaître.
  static Color? _tint(String? hex) {
    if (hex == null) return null;
    final int? rgb = int.tryParse(hex.replaceFirst('#', ''), radix: 16);
    return rgb == null || rgb > 0xFFFFFF ? null : Color(0xFF000000 | rgb);
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return CpiChoiceGroup<CallReason>(
      label: header,
      value: selected,
      options: <CpiChoice<CallReason>>[
        for (final CallReason reason in items)
          CpiChoice<CallReason>(
            value: reason,
            label: reason.label,
            subtitle: reason.requiresComment ? 'Commentaire obligatoire' : null,
            details: Icon(
              _icon(reason.effect),
              size: CpiIconSize.md,
              color: _tint(reason.color) ?? theme.colorScheme.onSurfaceVariant,
            ),
          ),
      ],
      onChanged: (CallReason reason) {
        if (reason != selected) onChanged(reason);
      },
    );
  }
}

/// Encart d'alerte : rouge pour ce qui bloque, neutre pour ce qui informe.
class _Notice extends StatelessWidget {
  const _Notice({
    required this.icon,
    required this.message,
    this.danger = true,
    this.live = false,
  });

  final IconData icon;
  final String message;
  final bool danger;

  /// Passer à true pour un message qui apparaît sur un geste : le lecteur
  /// d'écran doit le relire sans que le doigt reparte le chercher.
  final bool live;

  @override
  Widget build(BuildContext context) {
    final Widget alert = FAlert(
      variant: danger ? FAlertVariant.destructive : FAlertVariant.primary,
      icon: Icon(icon),
      title: Text(message),
    );
    if (!live) return alert;
    return Semantics(liveRegion: true, child: alert);
  }
}

class _SpringIn extends StatefulWidget {
  const _SpringIn({required this.child});

  final Widget child;

  @override
  State<_SpringIn> createState() => _SpringInState();
}

class _SpringInState extends State<_SpringIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this);
  late final CurvedAnimation _curved = CurvedAnimation(
    parent: _controller,
    curve: Curves.linear,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final Duration duration = CpiMotion.of(context).component;
    _controller.duration = duration;
    _curved.curve = CpiMotion.of(context).easeSpring;
    if (duration == Duration.zero) {
      _controller.value = 1;
    } else if (!_controller.isAnimating && _controller.value == 0) {
      unawaited(_controller.forward());
    }
  }

  @override
  void dispose() {
    _curved.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(scale: _curved, child: widget.child);
  }
}
