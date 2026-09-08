import 'dart:async';

import 'package:flutter/foundation.dart' show mapEquals;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/notifications/rep_callback_notifications.dart';
import '../../../core/ouvertures/ouverture_fiche_mixin.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/telephonie/appels_crm.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../core/utils/relative_time.dart';
import '../../../core/utils/whatsapp.dart';
import '../../../data/local/database.dart';
import '../../../core/drafts/draft_form_mixin.dart';
import '../../../data/repositories/draft_repository.dart';
import '../../../data/repositories/ouverture_repository.dart';
import '../../../data/repositories/reference_repository.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_choice_group.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../../ui/widgets/cpi_steps.dart';
import '../../../ui/widgets/local_typeahead.dart';
import '../../../ui/widgets/phone_field.dart';
import '../../permissions/alarme_permission.dart';
import '../../phase2/presentation/callback_picker.dart';
import '../../rappels/presentation/rappels_screen.dart' show quandRappeler;
import 'representant_detail_screen.dart'
    show StatutTag, libelleIssueRepresentant;
import 'representant_form_screen.dart' show kProfessionsFrequentes;

/// L'appel a abouti, ou non. Ce qu'il a donné se dit ensuite, au statut.
enum _Resultat { joignable, injoignable }

/// La fiche avant d'appeler, le résultat et son statut, la vérification de ce
/// qui a été importé puis les renseignements si le statut les exige encore, et
/// enfin le rappel, le commentaire et l'envoi.
enum _Etape { fiche, resultat, verification, renseignements, statut, fin }

/// La fiche importée, figée à l'ouverture. C'est l'écart avec elle qui fait
/// une correction ; ce qui n'a pas bougé ne repart pas.
typedef _Fiche = ({
  String prenom,
  String nom,
  String phoneE164,
  String etablissement,
  String profession,
  String syndicat,
  String whatsappStatus,
  String? whatsappE164,
  String? notes,
  String departementId,
  String? iefId,
});

/// Les effets proposés par branche. La règle tient à l'EFFET et jamais au
/// libellé, que l'administrateur renomme. Un numéro faux a bien été composé et
/// a répondu : il est joint. Un rappel promis se prend en parlant, il n'est
/// donc plus proposé à qui n'a pas décroché.
const Set<String> _effetsJoignable = <String>{
  'REACHED',
  'REFUSED',
  'SCHEDULE_CALLBACK',
  'WRONG_NUMBER',
};

const Set<String> _effetsInjoignable = <String>{'UNREACHABLE'};

/// L'issue que porte un statut. Le serveur fait la MÊME dérivation et refuse
/// une issue qui la contredit (`REP_OUTCOME_STATUT_MISMATCH`) : les deux
/// calculs doivent coïncider exactement.
String? issueDuStatut(String effet) => const <String, String>{
  'REACHED': 'REACHED',
  'REFUSED': 'REFUSED',
  'SCHEDULE_CALLBACK': 'CALLBACK',
  'UNREACHABLE': 'UNREACHABLE',
  'WRONG_NUMBER': 'WRONG_NUMBER',
}[effet];

/// La question qui pose le statut : oui rattache la personne, non la refuse.
const String kQuestionCHUES = 'Souhaite-t-il être représentant CHUES ?';

/// La réponse que ce statut vaut, nulle quand il ne répond pas à la question.
/// Le serveur refuse une relation qui contredit le statut posé
/// (`REP_RELATION_STATUT_MISMATCH`) : choisir le statut dans la liste doit donc
/// répondre à la question, jamais la laisser diverger.
bool? souhaitDuStatut(StatutQualificationRow? statut) =>
    switch (statut?.relationStatus) {
      'AMBASSADEUR' => true,
      'REFUS' => false,
      _ => null,
    };

const String kQuestionManquante = 'Répondez à la question CHUES';

/// Les deux « Autre » portent leur famille dans le libellé parce que le serveur
/// exige un libellé unique. Sous une branche déjà choisie, la répéter serait
/// redondant.
String libelleStatut(StatutQualificationRow statut) =>
    statut.code == 'AUTRE_JOINT' || statut.code == 'AUTRE_NON_JOINT'
    ? 'Autre'
    : statut.label;

/// L'issue d'un appareil dont le référentiel n'est pas descendu : ce que ce
/// script tirait de ses questions avant que le statut existe.
String _issueSansStatut({required bool joignable, required bool accepte}) {
  if (!joignable) return 'UNREACHABLE';
  return accepte ? 'REACHED' : 'REFUSED';
}

class RepresentantQualificationScreen extends ConsumerStatefulWidget {
  const RepresentantQualificationScreen({
    super.key,
    required this.representantId,
    this.puisProspects = false,
  });

  final String representantId;

  /// L'appel vient d'aboutir et le representant donne ses contacts : la saisie
  /// des prospects suit l'enregistrement. Un injoignable n'a rien a donner, il
  /// rend la main comme d'habitude.
  final bool puisProspects;

  @override
  ConsumerState<RepresentantQualificationScreen> createState() =>
      _RepresentantQualificationScreenState();
}

class _RepresentantQualificationScreenState
    extends ConsumerState<RepresentantQualificationScreen>
    with
        DraftFormMixin<RepresentantQualificationScreen>,
        OuvertureFicheMixin<RepresentantQualificationScreen> {
  final TextEditingController whatsapp = TextEditingController();
  final TextEditingController commentaire = TextEditingController();
  final TextEditingController suggestionTelephone = TextEditingController();
  final TextEditingController suggestionNom = TextEditingController();
  final TextEditingController suggestionNote = TextEditingController();
  final TextEditingController etablissement = TextEditingController();
  final TextEditingController syndicatNom = TextEditingController();
  final TextEditingController prenom = TextEditingController();
  final TextEditingController nom = TextEditingController();
  final TextEditingController telephone = TextEditingController();
  final TextEditingController profession = TextEditingController();
  final TextEditingController departement = TextEditingController();
  final TextEditingController ief = TextEditingController();
  final FocusNode syndicatFocus = FocusNode();
  final FocusNode professionFocus = FocusNode();
  final FocusNode departementFocus = FocusNode();
  final FocusNode iefFocus = FocusNode();
  _Resultat? resultat;
  StatutQualificationRow? statutChoisi;
  bool? aEteContacte;
  bool? connaitUES;
  String? syndicatId;
  String? professionId;
  String? departementId;
  String? iefId;
  String whatsappStatus = WhatsappStatus.nonDemande.code;
  bool? representantCHUES;
  DateTime? rappelAt;
  bool saving = false;
  String? echec;

  /// La personne a raccroché avant la fin du script : on saute au statut, et
  /// ce qui a été répondu reste (EB-10).
  bool scriptAbrege = false;

  /// Ce que le verrou vient de refuser. Bande et non toast : le refus doit
  /// rester lisible tant que le statut n'est pas posé.
  String? refus;

  _Fiche? fiche;

  _Etape etape = _Etape.fiche;
  bool enAvant = true;

  /// EB-10 : ce qui a été saisi survit à « À rappeler » et à la mort de l'app.
  /// Le brouillon est rangé SOUS LA FICHE : au rappel, le formulaire se rouvre
  /// avec les réponses du dernier appel.
  @override
  String get draftId => 'qualification:${widget.representantId}';

  @override
  String get draftFormKey => 'representant_qualification';

  @override
  String? get draftEntityId => widget.representantId;

  @override
  int get draftStep => parcours.indexOf(etape);

  @override
  DraftRepository get draftRepository => ref.read(draftRepositoryProvider);

  @override
  bool get draftIsEmpty => !aSaisi;

  @override
  Map<String, Object?> collectDraftValues() => <String, Object?>{
    'resultat': resultat?.name,
    'scriptAbrege': scriptAbrege,
    'statutCode': statutChoisi?.code,
    'aEteContacte': aEteContacte,
    'connaitUES': connaitUES,
    'representantCHUES': representantCHUES,
    'commentaire': commentaire.text,
    'rappelAt': rappelAt?.toIso8601String(),
    'whatsappStatus': whatsappStatus,
    'whatsapp': whatsapp.text,
    'prenom': prenom.text,
    'nom': nom.text,
    'telephone': telephone.text,
    'etablissement': etablissement.text,
    'profession': profession.text,
    'syndicat': syndicatNom.text,
    'suggestionTelephone': suggestionTelephone.text,
    'suggestionNom': suggestionNom.text,
    'suggestionNote': suggestionNote.text,
  };

  /// Le brouillon du dernier appel, repris APRÈS la fiche importée : c'est lui
  /// qui a raison, il porte ce que le téléconseiller avait déjà corrigé.
  Future<void> reprendreLeBrouillon() async {
    final DraftSnapshot? repris = await draftRepository.read(draftId);
    if (repris == null || !mounted) return;
    final Map<String, Object?> valeurs = repris.values;
    String texte(String cle) =>
        valeurs[cle] is String ? valeurs[cle]! as String : '';
    bool? oui(String cle) =>
        valeurs[cle] is bool ? valeurs[cle]! as bool : null;

    setState(() {
      resultat = _Resultat.values
          .where((_Resultat r) => r.name == valeurs['resultat'])
          .firstOrNull;
      scriptAbrege = valeurs['scriptAbrege'] == true;
      statutChoisi = statutsDuReferentiel
          .where((StatutQualificationRow r) => r.code == valeurs['statutCode'])
          .firstOrNull;
      aEteContacte = oui('aEteContacte');
      connaitUES = oui('connaitUES');
      representantCHUES = oui('representantCHUES');
      commentaire.text = texte('commentaire');
      rappelAt = DateTime.tryParse(texte('rappelAt'));
      if (texte('whatsappStatus').isNotEmpty) {
        whatsappStatus = texte('whatsappStatus');
      }
      whatsapp.text = texte('whatsapp');
      if (texte('prenom').isNotEmpty) prenom.text = texte('prenom');
      if (texte('nom').isNotEmpty) nom.text = texte('nom');
      if (texte('telephone').isNotEmpty) telephone.text = texte('telephone');
      etablissement.text = texte('etablissement');
      profession.text = texte('profession');
      syndicatNom.text = texte('syndicat');
      suggestionTelephone.text = texte('suggestionTelephone');
      suggestionNom.text = texte('suggestionNom');
      suggestionNote.text = texte('suggestionNote');
    });
  }

  static const Map<_Etape, String> questions = <_Etape, String>{
    _Etape.fiche: 'Avant l\'appel',
    _Etape.resultat: 'Comment s\'est passé l\'appel ?',
    _Etape.verification: 'Vérifier la fiche',
    _Etape.renseignements: 'Ce qu\'il vous a dit',
    _Etape.statut: 'Statut de qualification',
    _Etape.fin: 'Pour finir',
  };

  @override
  void initState() {
    super.initState();
    unawaited(semerLaFiche());
  }

  /// Toute réponse qui redessine l'écran salit le brouillon. Le poser ici
  /// plutôt qu'à chacun des trente `setState` de cet écran est ce qui garantit
  /// qu'aucune n'est oubliée.
  @override
  void setState(VoidCallback fn) {
    super.setState(fn);
    markDraftDirty();
    signalerLaSaisie();
  }

  /// Les réponses au dernier passage. Le chronomètre part d'une réponse qui a
  /// CHANGÉ : le refus affiché, l'étape tournée et la fiche importée
  /// redessinent l'écran sans que rien n'ait été saisi.
  Map<String, Object?> dernieresReponses = const <String, Object?>{};

  void signalerLaSaisie() {
    final Map<String, Object?> reponses = collectDraftValues();
    if (mapEquals(dernieresReponses, reponses)) return;
    dernieresReponses = reponses;
    unawaited(premiereSaisie(reponses));
  }

  @override
  void dispose() {
    whatsapp.dispose();
    commentaire.dispose();
    suggestionTelephone.dispose();
    suggestionNom.dispose();
    suggestionNote.dispose();
    etablissement.dispose();
    syndicatNom.dispose();
    prenom.dispose();
    nom.dispose();
    telephone.dispose();
    profession.dispose();
    departement.dispose();
    ief.dispose();
    syndicatFocus.dispose();
    professionFocus.dispose();
    departementFocus.dispose();
    iefFocus.dispose();
    super.dispose();
  }

  /// Une seule fois, à l'ouverture : une remontée du flux recouvrirait ce que
  /// le téléconseiller vient de corriger pendant l'appel.
  Future<void> semerLaFiche() async {
    final ReferenceRepository refs = ref.read(referenceRepositoryProvider);
    final Representant? row = await refs.representantById(
      widget.representantId,
    );
    if (row == null || !mounted) return;
    final Departement? dep = await refs.departementById(row.departementId);
    final Ief? inspection = row.iefId == null
        ? null
        : await refs.iefById(row.iefId!);
    if (!mounted) return;
    final _Fiche importee = (
      prenom: (row.prenom ?? '').trim(),
      nom: row.fullName.trim(),
      phoneE164: row.phoneE164,
      etablissement: (row.etablissement ?? '').trim(),
      profession: (row.profession ?? '').trim(),
      syndicat: (row.syndicat ?? '').trim(),
      whatsappStatus: row.whatsappStatus,
      whatsappE164: row.whatsappE164,
      notes: row.notes,
      departementId: row.departementId,
      iefId: row.iefId,
    );
    setState(() {
      fiche = importee;
      prenom.text = importee.prenom;
      nom.text = importee.nom;
      telephone.text = Phone.groupNational(Phone.digitsOf(importee.phoneE164));
      etablissement.text = importee.etablissement;
      profession.text = importee.profession;
      professionId = kProfessionsFrequentes.contains(importee.profession)
          ? importee.profession
          : null;
      syndicatNom.text = importee.syndicat;
      whatsappStatus = importee.whatsappStatus;
      whatsapp.text = Phone.groupNational(
        Phone.digitsOf(importee.whatsappE164 ?? ''),
      );
      departementId = importee.departementId;
      departement.text = dep?.name ?? '';
      iefId = importee.iefId;
      ief.text = inspection?.name ?? '';
    });
    await reprendreLeBrouillon();
    if (!mounted) return;
    await prendreLaFiche(importee);
  }

  /// Le nom tel qu'il se dit : le nom complet importé porte souvent déjà le
  /// prénom, et le répéter donnerait « Ndiaye Awa Awa ».
  static String nomComplet(String prenom, String nom) =>
      prenom.isEmpty || nom.contains(prenom) ? nom : '$nom $prenom';

  /// EB-07 et EB-08 : l'ouverture se confirme, s'enregistre, et pose le verrou.
  ///
  /// La fiche déjà tenue par ce compte se rouvre SANS redemander : c'est la
  /// reprise après une fermeture ou un plantage, et chaque confirmation compte
  /// une ouverture de plus.
  Future<void> prendreLaFiche(_Fiche importee) async {
    if (compteConnecte == null) return;
    final OuverturesFicheData? deja = await ficheEnCours();
    if (!mounted) return;
    if (deja?.representantId != widget.representantId &&
        ref.read(verrouFichesProvider)) {
      final bool ouvrir = await confirmerLOuverture(
        nomComplet(importee.prenom, importee.nom),
      );
      if (!mounted) return;
      if (!ouvrir) {
        popOrHome(context);
        return;
      }
    }

    final OuvertureResultat resultat;
    try {
      resultat = await ouvrirLaFiche(representantId: widget.representantId);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => echec = 'Ouverture impossible. $error');
      return;
    }
    if (!mounted) return;

    final FicheTenue? tenue = resultat.tenue;
    if (tenue != null) await proposerLaFicheTenue(tenue);
  }

  /// Le serveur refuse la seconde fiche sans dire laquelle il tient. Sans
  /// cette issue, le téléconseiller reste devant un refus qu'il ne peut pas
  /// lever.
  Future<void> proposerLaFicheTenue(FicheTenue tenue) async {
    final String? autre = tenue.representantId;
    final String? nom = autre == null
        ? tenue.ficheNom
        : (await ref.read(referenceRepositoryProvider).representantById(autre))
                  ?.fullName ??
              tenue.ficheNom;
    if (!mounted) return;
    final bool? reprendre = await cpiConfirm(
      context,
      title: 'Fiche en cours',
      message: nom == null
          ? 'Vous tenez déjà une fiche. Qualifiez-la avant d\'en ouvrir une autre.'
          : 'Vous tenez déjà la fiche de $nom. Qualifiez-la avant d\'en ouvrir une autre.',
      confirmLabel: autre == null ? 'Revenir' : 'Reprendre',
      cancelLabel: 'Revenir',
    );
    if (!mounted) return;
    if (reprendre == true && autre != null) {
      context.go(Routes.representantQualificationFor(autre));
      return;
    }
    popOrHome(context);
  }

  /// Une personne proposée à la place de celle qu'on vient d'appeler : elle
  /// n'a de sens que sur un refus, dit par le statut ou par la question.
  bool get proposeQuelquUn =>
      resultat == _Resultat.joignable &&
      (statutRetenu?.effect == 'REFUSED' || representantCHUES == false);

  /// Le script se pose à qui a décroché ; le statut vient APRÈS lui.
  bool get scriptPose => resultat == _Resultat.joignable;

  /// Le script est exigé en entier, sauf quand la personne a raccroché avant
  /// la fin : ce qui a été répondu part, le reste ne retient rien.
  bool get renseignementsExiges => scriptPose && !scriptAbrege;

  /// Le statut que pose la réponse à la question, pris dans le référentiel par
  /// la relation qu'il engage : le code n'est pas un contrat du client.
  StatutQualificationRow? statutParRelation(String relation) {
    for (final StatutQualificationRow s in statutsDuReferentiel) {
      if (s.relationStatus == relation) return s;
    }
    return null;
  }

  /// Ce qui part avec la tentative : le statut choisi à part, ou celui que la
  /// question vient de poser.
  StatutQualificationRow? get statutRetenu {
    final StatutQualificationRow? choisi = statutChoisi;
    if (choisi != null) return choisi;
    return switch (representantCHUES) {
      true => statutParRelation('AMBASSADEUR'),
      false => statutParRelation('REFUS'),
      null => null,
    };
  }

  /// La vérification se fait AU TÉLÉPHONE, avec la personne au bout du fil :
  /// elle suit donc le même sort que le script, jamais un injoignable ni un
  /// rappel promis sans échange.
  List<_Etape> get parcours => <_Etape>[
    _Etape.fiche,
    _Etape.resultat,
    if (scriptPose) ...<_Etape>[
      _Etape.verification,
      _Etape.renseignements,
      _Etape.statut,
    ],
    _Etape.fin,
  ];

  /// Ce que le téléconseiller a corrigé, libellé et nouvelle valeur. Vide :
  /// la fiche importée est exacte.
  List<(String, String)> get corrections {
    final _Fiche? avant = fiche;
    if (avant == null || !renseignementsExiges) {
      return const <(String, String)>[];
    }
    final String? numero = Phone.toE164(telephone.text);
    final String? whatsappSaisi = Phone.toE164(whatsapp.text);
    return <(String, String)>[
      if (prenom.text.trim() != avant.prenom) ('Prénom', prenom.text.trim()),
      if (nom.text.trim() != avant.nom) ('Nom', nom.text.trim()),
      if (numero != null && numero != avant.phoneE164)
        ('Téléphone', Phone.format(numero)),
      if (whatsappCorrige(avant))
        (
          'WhatsApp',
          whatsappStatus == WhatsappStatus.autreNumero.code &&
                  whatsappSaisi != null
              ? Phone.format(whatsappSaisi)
              : WhatsappStatus.parse(whatsappStatus)?.label ?? whatsappStatus,
        ),
      if (etablissement.text.trim() != avant.etablissement)
        ('Établissement', etablissement.text.trim()),
      if (profession.text.trim() != avant.profession)
        ('Profession', profession.text.trim()),
      if (syndicatNom.text.trim() != avant.syndicat)
        ('Syndicat', syndicatNom.text.trim()),
      if (departementId != avant.departementId)
        ('Département', departement.text.trim()),
      if (iefId != avant.iefId) ('IEF', ief.text.trim()),
    ];
  }

  String get compteurCorrections => corrections.length == 1
      ? '1 champ corrigé'
      : '${corrections.length} champs corrigés';

  /// Le référentiel descendu, dans l'ordre servi. Lu SOUS `build` :
  /// `ref.watch` est ce qui fait reparaître la liste quand la synchronisation
  /// la ramène.
  List<StatutQualificationRow> get statutsDuReferentiel =>
      ref.watch(statutsQualificationProvider).value ??
      const <StatutQualificationRow>[];

  /// Les statuts que la branche choisie propose. « Accepté » et « Refusé » y
  /// sont : le téléconseiller qui ne voit pas que la question vient de les
  /// poser les cherche là où il les a toujours choisis.
  List<StatutQualificationRow> get statutsProposes {
    final _Resultat? choix = resultat;
    if (choix == null) return const <StatutQualificationRow>[];
    final Set<String> admis = choix == _Resultat.joignable
        ? _effetsJoignable
        : _effetsInjoignable;
    return statutsDuReferentiel
        .where((StatutQualificationRow s) => admis.contains(s.effect))
        .toList(growable: false);
  }

  /// Le numéro seul ouvre la suggestion : le nom et la remarque ne se saisissent
  /// qu'après lui, et le serveur les jette sans numéro.
  bool get suggestionCommencee => suggestionTelephone.text.trim().isNotEmpty;

  /// [context] est pris SOUS la coque : le message passe par son `FToaster`.
  void erreur(BuildContext context, String message) =>
      cpiToast(context, message);

  /// Ce qui retient une étape, dit en une phrase. Null : on peut avancer.
  String? manqueEtape(_Etape e) => switch (e) {
    _Etape.fiche => null,
    _Etape.resultat => manqueResultat,
    _Etape.verification => manqueVerification,
    _Etape.renseignements => manqueRenseignements,
    _Etape.statut => manqueStatut,
    _Etape.fin => manqueFin,
  };

  /// Le référentiel pas encore descendu laisse passer, comme sur un appareil
  /// qui ne le connaît pas : l'issue se tire alors de la question.
  String? get manqueStatut => statutRetenu == null && statutsProposes.isNotEmpty
      ? 'Choisissez un statut'
      : null;

  /// Le statut demande une date : rappel promis, ou réessai d'un numéro qui
  /// n'a pas répondu.
  bool get dateDemandee =>
      (statutChoisi?.requiresCallback ?? false) ||
      statutChoisi?.retryAfterMinutes != null;

  bool get reessai =>
      statutChoisi?.retryAfterMinutes != null &&
      !(statutChoisi?.requiresCallback ?? false);

  /// Le statut exige de dire pourquoi. Le commentaire porte ce motif : le
  /// serveur refuse la tentative sans lui.
  bool get motifExige => statutRetenu?.requiresComment ?? false;

  String? get manqueFin {
    if (motifExige && commentaire.text.trim().isEmpty) {
      return 'Écrivez le motif';
    }
    if (dateDemandee && rappelAt == null) {
      return reessai
          ? 'Choisissez quand réessayer'
          : 'Choisissez quand rappeler';
    }
    if (proposeQuelquUn &&
        suggestionCommencee &&
        Phone.parse(suggestionTelephone.text) is! PhoneValid) {
      return 'Numéro de la personne proposée incomplet';
    }
    return null;
  }

  String? get manqueResultat {
    if (resultat == null) return 'Choisissez d\'abord le résultat';
    // Sur la branche jointe le statut vient après le script.
    if (resultat == _Resultat.injoignable) return manqueStatut;
    return null;
  }

  /// La fiche relue avec la personne au bout du fil. Ce qui est obligatoire
  /// l'est comme au formulaire : sans nom, sans numéro ou sans département, la
  /// fiche ne se synchronise plus.
  String? get manqueVerification {
    if (fiche == null) return 'Fiche pas encore chargée';
    if (nom.text.trim().length < 2) return 'Écrivez le nom complet';
    if (Phone.parse(telephone.text) is! PhoneValid) {
      return 'Écrivez le numéro de téléphone';
    }
    if (whatsappStatus == WhatsappStatus.autreNumero.code &&
        Phone.parse(whatsapp.text) is! PhoneValid) {
      return 'Écrivez le numéro WhatsApp';
    }
    if (departementId == null) return 'Choisissez le département';
    return null;
  }

  /// Les trois questions de la branche joignable, dans l'ordre du script. Ce
  /// que la fiche portait déjà se relit à l'étape précédente, il ne se
  /// redemande pas ici.
  String? get manqueRenseignements {
    if (aEteContacte == null) return 'Dites s\'il a été contacté';
    if (connaitUES == null) return 'Dites s\'il connaît l\'UES';
    if (representantCHUES == null) return kQuestionManquante;
    return null;
  }

  /// Ce qui manque encore pour enregistrer, toutes étapes confondues. Null
  /// quand la réponse est complète : le bouton s'allume alors.
  String? get manque =>
      manqueResultat ??
      (renseignementsExiges
          ? manqueVerification ?? manqueRenseignements
          : null) ??
      (scriptPose ? manqueStatut : null) ??
      manqueEtape(_Etape.fin);

  static String? _ouiNon(bool? value) =>
      value == null ? null : (value ? 'Oui' : 'Non');

  List<CpiRecapLine> recapDe(RepresentantSyncViewData? representant) {
    final List<(String, String)> corrigees = corrections;
    return <CpiRecapLine>[
      CpiRecapLine(
        'Personne appelée',
        renseignementsExiges ? nom.text.trim() : representant?.fullName,
      ),
      CpiRecapLine(
        'Téléphone',
        renseignementsExiges
            ? Phone.format(Phone.toE164(telephone.text) ?? '')
            : (representant == null
                  ? null
                  : Phone.format(representant.phoneE164)),
      ),
      CpiRecapLine('Résultat', switch (resultat) {
        _Resultat.joignable => 'Joignable',
        _Resultat.injoignable => 'Injoignable',
        null => null,
      }),
      if (renseignementsExiges)
        if (corrigees.isEmpty)
          const CpiRecapLine('Fiche vérifiée', 'Tout est exact')
        else ...<CpiRecapLine>[
          CpiRecapLine('Fiche vérifiée', compteurCorrections),
          for (final (String libelle, String valeur) in corrigees)
            CpiRecapLine(libelle, valeur),
        ],
      // Un script abrégé garde ce qui a été répondu.
      if (scriptPose) ...<CpiRecapLine>[
        if (aEteContacte != null)
          CpiRecapLine('A été contacté', _ouiNon(aEteContacte)),
        if (connaitUES != null)
          CpiRecapLine('Connaît l\'UES', _ouiNon(connaitUES)),
        if (representantCHUES != null)
          CpiRecapLine(kQuestionCHUES, _ouiNon(representantCHUES)),
      ],
      if (proposeQuelquUn && suggestionCommencee)
        CpiRecapLine(
          'Personne proposée',
          <String>[
            Phone.format(Phone.toE164(suggestionTelephone.text) ?? ''),
            suggestionNom.text.trim(),
          ].where((String s) => s.isNotEmpty).join(' · '),
        ),
      CpiRecapLine('Statut', switch (statutRetenu) {
        null => null,
        final StatutQualificationRow s => libelleStatut(s),
      }),
      if (rappelAt != null)
        CpiRecapLine(
          reessai ? 'Réessai' : 'Rappel',
          quandRappeler(context, rappelAt!, DateTime.now()),
        ),
      if (motifExige || commentaire.text.trim().isNotEmpty)
        CpiRecapLine(
          motifExige ? 'Motif' : 'Commentaire',
          commentaire.text.trim(),
        ),
    ];
  }

  bool get aSaisi =>
      resultat != null ||
      commentaire.text.trim().isNotEmpty ||
      corrections.isNotEmpty ||
      suggestionCommencee;

  /// EB-08 : une fiche ouverte ne se quitte pas, elle se qualifie. Le refus
  /// remplace l'ancienne confirmation, qui ne freinait la sortie que si
  /// quelque chose avait été saisi.
  void quitter() {
    if (sousVerrou) {
      setState(() => refus = 'Posez un statut avant de quitter cette fiche.');
      return;
    }
    popOrHome(context);
  }

  /// Le focus se lâche AVANT de retirer l'étape de l'arbre : un champ à
  /// complétion démonté avec le focus ferme ensuite une liste déjà disparue
  /// (`OverlayPortalController.hide`, `_zOrderIndex != null`).
  void _allerA(_Etape cible, {required bool avant}) {
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      enAvant = avant;
      etape = cible;
    });
  }

  void suivant() {
    final List<_Etape> etapes = parcours;
    final int index = etapes.indexOf(etape);
    if (index + 1 >= etapes.length) return;
    markDraftDirty();
    // Le script parcouru jusqu'au bout n'est plus abrégé.
    if (etape == _Etape.renseignements) scriptAbrege = false;
    _allerA(etapes[index + 1], avant: true);
    unawaited(remonterLeBrouillon(collectDraftValues()));
  }

  /// La personne raccroche avant la fin du script : droit au statut, sans
  /// rien perdre de ce qui a été répondu.
  void passerAuStatut() {
    markDraftDirty();
    scriptAbrege = true;
    _allerA(_Etape.statut, avant: true);
    unawaited(remonterLeBrouillon(collectDraftValues()));
  }

  void precedent() {
    final List<_Etape> etapes = parcours;
    final int index = etapes.indexOf(etape);
    if (index <= 0) {
      quitter();
      return;
    }
    _allerA(etapes[index - 1], avant: false);
  }

  bool whatsappCorrige(_Fiche avant) =>
      whatsappStatus != avant.whatsappStatus ||
      (whatsappStatus == WhatsappStatus.autreNumero.code &&
          Phone.toE164(whatsapp.text) != avant.whatsappE164);

  /// Les corrections que la tentative d'appel ne sait pas porter.
  bool ficheACorriger(_Fiche avant) =>
      prenom.text.trim() != avant.prenom ||
      nom.text.trim() != avant.nom ||
      profession.text.trim() != avant.profession ||
      departementId != avant.departementId ||
      iefId != avant.iefId;

  /// Vrai : la fiche disait juste. Faux : la valeur corrigée part avec la
  /// tentative. Nul : la fiche ne portait rien à confirmer.
  bool? etablissementConfirmeDe(_Fiche avant) {
    if (etablissement.text.trim() != avant.etablissement) return false;
    return avant.etablissement.isEmpty ? null : true;
  }

  /// Une fiche déjà qualifiée se réenregistre sur confirmation : l'écran
  /// s'ouvre aussi depuis une liste, et rien n'y dit qu'un collègue vient de
  /// passer l'appel.
  Future<bool> confirmerLaRequalification(BuildContext context) async {
    final RepresentantSyncViewData? deja = ref
        .read(representantDetailProvider(widget.representantId))
        .value;
    if (deja == null ||
        (deja.statutQualificationId == null && deja.callAttemptCount == 0)) {
      return true;
    }
    // Le bouton reste vivant pendant que la feuille est ouverte : sans ce
    // verrou, un second appui ouvrirait une deuxième feuille.
    setState(() => saving = true);
    final bool? poursuivre = await cpiConfirm(
      context,
      title: 'Déjà qualifié',
      message: messageDejaQualifie(deja),
      confirmLabel: 'Enregistrer',
      cancelLabel: 'Revenir',
    );
    if (!mounted) return false;
    if (poursuivre == true) return true;
    setState(() => saving = false);
    return false;
  }

  static String messageDejaQualifie(RepresentantSyncViewData deja) {
    final String? issue = deja.lastCallOutcome;
    final String? quoi =
        deja.statutQualificationLabel ??
        (issue == null ? null : libelleIssueRepresentant(issue));
    final DateTime? quand = deja.lastCallAt;
    if (quand == null) {
      return 'Cette fiche porte déjà une qualification. Enregistrer ce nouvel '
          'appel ?';
    }
    final String entete = 'Dernier appel ${relativeTime(quand)}';
    return quoi == null
        ? '$entete. Enregistrer ce nouvel appel ?'
        : '$entete : $quoi. Enregistrer ce nouvel appel ?';
  }

  Future<void> enregistrer(BuildContext context) async {
    // Deux appuis rapprochés consignaient deux appels : l'attente
    // d'autorisation d'alarme laissait le bouton vivant entre les deux.
    if (saving) return;
    final _Resultat? choix = resultat;
    if (choix == null) {
      erreur(context, 'Choisissez le résultat de l’appel.');
      return;
    }
    // Le bouton ne s'allume que quand `manque` est nul ; ce garde-fou ne fait
    // que nommer, sous la coque, la première question restée sans réponse si
    // l'écriture est déclenchée autrement.
    final String? manquant = manque;
    if (manquant != null) {
      erreur(context, manquant);
      return;
    }
    if (!await confirmerLaRequalification(context)) return;
    if (!context.mounted) return;

    final bool joignable = choix == _Resultat.joignable;
    final bool renseigne = renseignementsExiges;
    final bool accepte = representantCHUES == true;

    // Sans statut, l'issue reste celle que ce script tirait de ses questions :
    // c'est ce que consigne un appareil dont le référentiel n'est pas descendu.
    final StatutQualificationRow? statut = statutRetenu;
    final String issue =
        (statut == null ? null : issueDuStatut(statut.effect)) ??
        _issueSansStatut(joignable: joignable, accepte: accepte);

    final String? moi = ref.read(authControllerProvider).userId;
    final _Fiche? avant = renseigne ? fiche : null;

    final String? numeroCorrige = Phone.toE164(telephone.text);
    if (avant != null &&
        numeroCorrige != null &&
        numeroCorrige != avant.phoneE164) {
      final Representant? autre = await ref
          .read(referenceRepositoryProvider)
          .findRepresentantByPhone(numeroCorrige);
      if (!context.mounted) return;
      if (autre != null && autre.id != widget.representantId) {
        erreur(
          context,
          'Ce numéro est déjà celui de ${autre.fullName}. Corrigez-le ou '
          'gardez le numéro de la fiche.',
        );
        return;
      }
    }

    setState(() {
      saving = true;
      echec = null;
    });
    // Avant l'écriture, et seulement quand un rappel est promis : c'est le
    // seul moment où la demande d'autorisation s'explique d'elle-même. Un
    // refus n'empêche jamais de consigner l'appel.
    if (rappelAt != null) {
      await demanderLAlarme(context, ref);
      if (!context.mounted) return;
    }

    try {
      // Prénom, nom, département, IEF et profession : la tentative ne les
      // porte pas, ils passent par l'opération `representant`, enfilée AVANT
      // elle pour que le serveur les applique dans cet ordre.
      if (avant != null && ficheACorriger(avant)) {
        await ref
            .read(writeRepositoryProvider)
            .updateRepresentant(
              id: widget.representantId,
              fullName: nom.text.trim(),
              phoneE164: Phone.toE164(telephone.text) ?? avant.phoneE164,
              departementId: departementId ?? avant.departementId,
              iefId: iefId,
              notes: avant.notes,
              // Le canal WhatsApp part avec la tentative : le redire ici
              // écrirait deux fois la même bascule.
              whatsappStatus: avant.whatsappStatus,
              whatsappE164: avant.whatsappE164,
              profession: profession.text.trim().isEmpty
                  ? null
                  : profession.text.trim(),
              prenom: prenom.text.trim(),
            );
      }
      final String attemptId = await ref
          .read(writeRepositoryProvider)
          .recordRepCallAttempt(
            representantId: widget.representantId,
            createdById: moi,
            outcome: issue,
            statutQualificationId: statut?.id,
            // Ferme l'ouverture et arrête le chronomètre, ici comme au serveur.
            ouvertureId: ouverture?.id,
            createdByName: ref.read(authControllerProvider).fullName,
            // Une question sans réponse n'est pas un refus : le statut la pose
            // désormais facultative, et le serveur comble ce silence lui-même.
            relationStatus: representantCHUES == null
                ? null
                : (accepte ? 'AMBASSADEUR' : 'REFUS'),
            whatsappStatus: avant != null && whatsappCorrige(avant)
                ? whatsappStatus
                : null,
            whatsappE164: whatsappStatus == WhatsappStatus.autreNumero.code
                ? Phone.toE164(whatsapp.text)
                : null,
            comment: commentaire.text,
            callbackAt: rappelAt,
            // Ce que la vérification vient de relire avec la personne au bout
            // du fil. Une valeur corrigée part avec un « non confirmé » : c'est
            // à cette condition que le serveur la retient.
            etablissementConfirme: avant == null
                ? null
                : etablissementConfirmeDe(avant),
            etablissementSaisi: renseigne ? etablissement.text : null,
            numeroConfirme: avant == null
                ? null
                : Phone.toE164(telephone.text) == avant.phoneE164,
            numeroSaisi: renseigne ? telephone.text : null,
            contacte: aEteContacte,
            connaitUES: connaitUES,
            syndicat: renseigne ? syndicatNom.text : null,
            // Seulement quand la personne appelée a dit non : ailleurs, la
            // question de la remplaçante n'a pas été posée.
            suggestedPhone: proposeQuelquUn
                ? Phone.toE164(suggestionTelephone.text)
                : null,
            suggestedName: proposeQuelquUn ? suggestionNom.text : null,
            suggestedNote: proposeQuelquUn ? suggestionNote.text : null,
          );
      // L'appel qui vient d'être saisi honore ce qui avait été promis : la
      // promesse tenue restait sinon dans la liste des rappels, et son alarme
      // sonnait après coup.
      for (final String honore
          in await ref
              .read(writeRepositoryProvider)
              .honourRepCallbacks(
                representantId: widget.representantId,
                except: attemptId,
              )) {
        unawaited(ref.read(repCallbackNotificationsProvider).cancel(honore));
      }
      final DateTime? rappel = rappelAt;
      if (rappel != null) {
        final RepresentantSyncViewData? representant = ref
            .read(representantDetailProvider(widget.representantId))
            .value;
        unawaited(
          ref
              .read(repCallbackNotificationsProvider)
              .schedule(
                id: attemptId,
                representantId: widget.representantId,
                fullName: representant?.fullName ?? 'Représentant',
                phoneE164: representant?.phoneE164 ?? '',
                at: rappel,
              ),
        );
      }
      ref.read(syncCoordinatorProvider.notifier).nudge();
      libererLeVerrou();
      // Un rappel promis garde les réponses pour le prochain appel; une fiche
      // qualifiée pour de bon les rouvrirait sans raison.
      discardDraft();
      if (rappelAt == null) await draftRepository.delete(draftId);
      if (!context.mounted) return;
      if (widget.puisProspects && joignable) {
        context.pushReplacement(Routes.newProspectFor(widget.representantId));
        return;
      }
      // Rouverte au démarrage, la fiche est la seule route : la dépiler
      // laisserait un écran noir.
      popOrHome(context, fallback: Routes.chues);
    } on Object catch (error) {
      if (!context.mounted) return;
      setState(() {
        saving = false;
        echec = 'Enregistrement impossible. $error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // L'abonnement au référentiel se prend ici : `statutsProposes` le relit
    // aussi depuis un geste, où `ref.watch` n'a pas cours.
    ref.watch(statutsQualificationProvider);
    final ThemeData theme = Theme.of(context);
    final RepresentantSyncViewData? representant = ref
        .watch(representantDetailProvider(widget.representantId))
        .value;
    final List<_Etape> etapes = parcours;
    final bool premiere = etape == _Etape.fiche;
    final String question = questions[etape]!;

    return CpiStepScope(
      first: premiere,
      onExit: quitter,
      onBack: saving ? null : precedent,
      child: CpiScaffold(
        title: question,
        showTitle: false,
        leading: CpiHeaderAction(
          icon: PhosphorIconsRegular.arrowLeft,
          label: premiere ? 'Retour' : 'Étape précédente',
          onPressed: saving ? null : precedent,
        ),
        banner: switch ((echec, refus)) {
          (final String message, _) => CpiStatusBand(
            text: message,
            tone: CpiTone.danger,
            actionLabel: 'Réessayer',
            onAction: () => unawaited(enregistrer(context)),
          ),
          // Le statut posé lève le verrou : le refus n'a plus lieu d'être.
          (_, final String message) when statutRetenu == null => CpiStatusBand(
            text: message,
            tone: CpiTone.warning,
          ),
          _ => null,
        },
        footer: CpiActionBar(child: _pied(context)),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            ?chronometre(theme),
            CpiStepHeader(
              step: etapes.indexOf(etape) + 1,
              total: etapes.length,
              question: question,
              forward: enAvant,
            ),
            Expanded(
              child: switch (etape) {
                _Etape.fiche => _corpsFiche(theme, representant),
                _Etape.resultat => _corpsResultat(theme, representant),
                _Etape.verification => _corpsVerification(theme),
                _Etape.renseignements => _corpsRenseignements(theme),
                _Etape.statut => _corpsStatut(theme),
                _Etape.fin => _corpsFin(theme, representant),
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _pied(BuildContext context) => switch (etape) {
    _Etape.fiche => CpiButton(
      'Consigner l\'appel',
      icon: PhosphorIconsRegular.phoneCall,
      onPressed: suivant,
    ),
    _Etape.resultat || _Etape.statut => CpiButton(
      'Continuer',
      icon: PhosphorIconsRegular.arrowRight,
      subtitle: manqueEtape(etape),
      onPressed: manqueEtape(etape) == null ? suivant : null,
    ),
    _Etape.renseignements => _piedDuScript(
      CpiButton(
        'Continuer',
        icon: PhosphorIconsRegular.arrowRight,
        subtitle: manqueRenseignements,
        onPressed: manqueRenseignements == null ? suivant : null,
      ),
    ),
    // Rien à corriger se valide d'un geste ; dès qu'un champ bouge, le bouton
    // redevient un simple passage à la suite.
    _Etape.verification => _piedDuScript(
      CpiButton(
        corrections.isEmpty ? 'Tout est exact' : 'Continuer',
        icon: corrections.isEmpty
            ? PhosphorIconsRegular.check
            : PhosphorIconsRegular.arrowRight,
        subtitle: manqueVerification,
        onPressed: manqueVerification == null ? suivant : null,
      ),
    ),
    _Etape.fin => Builder(
      builder: (BuildContext context) => CpiButton(
        'Enregistrer',
        loading: saving,
        subtitle: manque,
        onPressed: manque == null
            ? () => unawaited(enregistrer(context))
            : null,
      ),
    ),
  };

  /// Sous le script, l'issue de secours : la personne doit raccrocher, le
  /// statut se pose tout de suite et les réponses déjà prises restent.
  Widget _piedDuScript(Widget principal) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      principal,
      const SizedBox(height: CpiSpacing.xs),
      CpiButton(
        'Il doit raccrocher, passer au statut',
        variant: CpiButtonVariant.secondary,
        icon: PhosphorIconsRegular.phoneX,
        onPressed: passerAuStatut,
      ),
    ],
  );

  static EdgeInsets get _marge =>
      const EdgeInsets.fromLTRB(CpiSpacing.md, 0, CpiSpacing.md, CpiSpacing.md);

  /// Étape 1 : la fiche telle qu'elle est, avant de composer le numéro.
  Widget _corpsFiche(ThemeData theme, RepresentantSyncViewData? representant) {
    if (representant == null) {
      return const Center(
        child: FCircularProgress(semanticsLabel: 'Chargement'),
      );
    }
    // Le nom complet importé porte souvent déjà le prénom : ne pas le redire.
    final String prenom = (representant.prenom ?? '').trim();
    final String nom = prenom.isEmpty || representant.fullName.contains(prenom)
        ? representant.fullName
        : '${representant.fullName} $prenom';
    final WhatsappStatus? whatsapp = WhatsappStatus.parse(
      representant.whatsappStatus,
    );
    final String? whatsappLigne = switch (whatsapp) {
      WhatsappStatus.memeNumero => 'Même numéro',
      WhatsappStatus.autreNumero when representant.whatsappE164 != null =>
        Phone.format(representant.whatsappE164!),
      _ => null,
    };
    final DateTime? dernier = representant.lastCallAt;
    final String? issue = representant.lastCallOutcome;
    final int tentatives = representant.callAttemptCount;
    final PreuvesAppelData? preuve = ref
        .watch(
          dernierePreuveProvider((
            kind: 'representant',
            id: widget.representantId,
          )),
        )
        .value;

    return ListView(
      padding: _marge,
      children: <Widget>[
        // Même pastille que la fiche : « Statut actuel » en ligne débordait
        // sur un petit écran avec un libellé long.
        Row(
          children: <Widget>[
            Expanded(
              child: Text('Statut actuel', style: theme.textTheme.titleSmall),
            ),
            StatutTag(
              relationStatus: representant.relationStatus,
              statutLabel: representant.statutQualificationLabel,
              statutEffect: representant.statutQualificationEffect,
              lastCallOutcome: representant.lastCallOutcome,
            ),
          ],
        ),
        const SizedBox(height: CpiSpacing.sm),
        CpiCard.rows(<CpiRow>[
          CpiRow(title: 'Nom', subtitle: nom),
          CpiRow(
            title: 'Téléphone',
            subtitle: preuve == null
                ? Phone.format(representant.phoneE164)
                : '${Phone.format(representant.phoneE164)}\n${preuve.libelle}',
          ),
          if (whatsappLigne != null)
            CpiRow(title: 'WhatsApp', subtitle: whatsappLigne),
          if ((representant.etablissement ?? '').trim().isNotEmpty)
            CpiRow(
              title: 'Établissement',
              subtitle: representant.etablissement!.trim(),
            ),
          if ((representant.profession ?? '').trim().isNotEmpty)
            CpiRow(
              title: 'Profession',
              subtitle: representant.profession!.trim(),
            ),
        ]),
        const SizedBox(height: CpiSpacing.sm),
        CpiCard.rows(<CpiRow>[
          CpiRow(
            title: 'Dernière interaction',
            subtitle: dernier == null ? 'Jamais appelé' : relativeTime(dernier),
          ),
          if (issue != null)
            CpiRow(
              title: 'Résultat',
              subtitle: libelleIssueRepresentant(issue),
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
        ..._historique(theme),
      ],
    );
  }

  /// EB-11 : ce que les appels précédents ont dit, en LECTURE SEULE. Une
  /// entrée passée ne se modifie jamais ; qualifier de nouveau en ajoute une.
  ///
  /// Le libellé et le caractère obligatoire du motif viennent du référentiel,
  /// joint à la volée : recopiés dans l'historique, ils figeraient le jour où
  /// l'administrateur renomme.
  List<Widget> _historique(ThemeData theme) {
    final List<HistoriqueRepresentantResult> entrees =
        ref
            .watch(historiqueRepresentantProvider(widget.representantId))
            .value ??
        const <HistoriqueRepresentantResult>[];
    if (entrees.isEmpty) return const <Widget>[];
    return <Widget>[
      const SizedBox(height: CpiSpacing.md),
      Text('Historique', style: theme.textTheme.titleSmall),
      for (final HistoriqueRepresentantResult entree in entrees) ...<Widget>[
        const SizedBox(height: CpiSpacing.sm),
        CpiCard.rows(<CpiRow>[
          CpiRow(
            title: relativeTime(entree.clientCreatedAt),
            subtitle: entree.createdByName,
          ),
          CpiRow(
            title: 'Statut',
            subtitle:
                entree.statutLabel ?? libelleIssueRepresentant(entree.outcome),
          ),
          if (entree.contacte != null)
            CpiRow(title: 'A été contacté', subtitle: _ouiNon(entree.contacte)),
          if (entree.connaitUes != null)
            CpiRow(
              title: 'Connaît l\'UES',
              subtitle: _ouiNon(entree.connaitUes),
            ),
          if (entree.relationStatus != null)
            CpiRow(
              title: kQuestionCHUES,
              subtitle: _ouiNon(entree.relationStatus == 'AMBASSADEUR'),
            ),
          if ((entree.comment ?? '').trim().isNotEmpty)
            CpiRow(
              title: (entree.statutRequiresComment ?? false)
                  ? 'Motif'
                  : 'Commentaire',
              subtitle: entree.comment!.trim(),
            ),
          // Le temps passé SUR LA FICHE, à ne pas confondre avec le temps
          // passé AU TÉLÉPHONE. Nul pour un appel d'avant le chronomètre, et
          // « 0 s » y serait un mensonge.
          if (entree.dureeTraitementSecondes != null)
            CpiRow(
              title: 'Temps sur la fiche',
              subtitle: chrono(
                Duration(seconds: entree.dureeTraitementSecondes!),
              ),
            ),
        ]),
      ],
    ];
  }

  /// Étape 2 : le résultat de l'appel et le statut qui le résume.
  Widget _corpsResultat(
    ThemeData theme,
    RepresentantSyncViewData? representant,
  ) => ListView(
    padding: _marge,
    children: <Widget>[
      CpiCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              representant == null
                  ? 'Représentant'
                  : <String>[
                      representant.fullName,
                      ?representant.prenom,
                    ].where((String s) => s.isNotEmpty).join(' '),
              style: theme.textTheme.titleMedium,
            ),
            if (representant != null)
              Text(
                Phone.format(representant.phoneE164),
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
          ],
        ),
      ),
      const SizedBox(height: CpiSpacing.lg),
      _ChoixUnique<_Resultat>(
        // L'en-tête d'étape pose déjà la question.
        label: questions[_Etape.resultat]!,
        showLabel: false,
        value: resultat,
        // Le statut et son heure repartent de zéro : les deux branches ne
        // proposent pas les mêmes, et celui qu'on quitte laisserait sinon sa
        // date derrière lui.
        onChanged: (_Resultat choix) => setState(() {
          resultat = choix;
          statutChoisi = null;
          rappelAt = null;
          scriptAbrege = false;
          // La question CHUES ne se pose qu'à qui a décroché. Gardée d'un appel
          // précédent, elle pose un statut de la branche jointe sur un
          // injoignable, sans rien cocher dans la liste affichée.
          if (choix == _Resultat.injoignable) representantCHUES = null;
        }),
        options: const <(_Resultat, String)>[
          (_Resultat.joignable, 'Joignable'),
          (_Resultat.injoignable, 'Injoignable'),
        ],
      ),
      // Qui n'a pas décroché se qualifie ici ; qui a décroché, après le script.
      if (resultat == _Resultat.injoignable) ...<Widget>[
        const SizedBox(height: CpiSpacing.lg),
        ..._choixDuStatut(),
      ],
    ],
  );

  /// Rien à montrer tant que le référentiel n'est pas descendu.
  List<Widget> _choixDuStatut() => <Widget>[
    if (statutsProposes.isNotEmpty)
      _ChoixUnique<StatutQualificationRow>(
        label: 'Statut de qualification',
        // Sur la branche jointe, la réponse à la question a déjà coché
        // Accepté ou Refusé ; la liste laisse en changer.
        value: statutRetenu,
        onChanged: (StatutQualificationRow statut) => setState(() {
          statutChoisi = statut;
          final bool? souhait = souhaitDuStatut(statut);
          if (souhait != null) representantCHUES = souhait;
          // Un numéro occupé se retente : le réessai arrive préréglé au
          // délai du statut, l'appelant le déplace s'il veut.
          final int? reessai = statut.retryAfterMinutes;
          rappelAt = reessai == null
              ? null
              : DateTime.now().add(Duration(minutes: reessai));
        }),
        options: <(StatutQualificationRow, String)>[
          for (final StatutQualificationRow s in statutsProposes)
            (s, libelleStatut(s)),
        ],
      ),
  ];

  /// Étape 5 de la branche jointe : le statut, une fois le script posé.
  Widget _corpsStatut(ThemeData theme) => ListView(
    padding: _marge,
    children: <Widget>[
      if (representantCHUES != null && statutChoisi == null) ...<Widget>[
        CpiStatusBand(
          text: representantCHUES!
              ? 'Il souhaite être représentant : Accepté est coché.'
              : 'Il ne souhaite pas être représentant : Refusé est coché.',
          tone: CpiTone.neutral,
          padded: false,
        ),
        const SizedBox(height: CpiSpacing.md),
      ],
      ..._choixDuStatut(),
    ],
  );

  /// Étape 3 : la fiche importée, relue avec la personne au bout du fil. Les
  /// valeurs se corrigent directement, au lieu de répondre « oui » ou « non »
  /// à leur sujet.
  Widget _corpsVerification(ThemeData theme) {
    final List<Departement> departements =
        ref.watch(departementsProvider(null)).value ?? const <Departement>[];
    final List<Ief> iefs =
        ref.watch(iefsProvider(departementId)).value ?? const <Ief>[];
    final int corrigees = corrections.length;

    return ListView(
      padding: _marge,
      children: <Widget>[
        if (corrigees > 0) ...<Widget>[
          CpiStatusBand(
            text: compteurCorrections,
            tone: CpiTone.success,
            padded: false,
          ),
          const SizedBox(height: CpiSpacing.md),
        ],
        CpiField(
          label: 'Prénom',
          controller: prenom,
          hint: 'Ex. Mamadou',
          textCapitalization: TextCapitalization.words,
          onChanged: (String _) => setState(() {}),
        ),
        const SizedBox(height: CpiSpacing.md),
        CpiField(
          label: 'Nom complet',
          controller: nom,
          hint: 'Ex. Mamadou Diallo',
          textCapitalization: TextCapitalization.words,
          onChanged: (String _) => setState(() {}),
        ),
        const SizedBox(height: CpiSpacing.md),
        PhoneField(
          controller: telephone,
          onChanged: (String _) => setState(() {}),
        ),
        const SizedBox(height: CpiSpacing.md),
        CpiChoiceGroup<String>(
          label: 'WhatsApp',
          description: whatsappStatus == WhatsappStatus.nonDemande.code
              ? 'Question non posée.'
              : null,
          value: whatsappStatus,
          options: <CpiChoice<String>>[
            for (final String code in _codesWhatsapp)
              CpiChoice<String>(
                value: code,
                label: WhatsappStatus.parse(code)?.label ?? code,
              ),
          ],
          // Retoucher la puce choisie repose la question : c'est le seul
          // chemin vers « non demandé » une fois qu'une réponse a été prise.
          onChanged: (String code) => setState(() {
            whatsappStatus = code == whatsappStatus
                ? WhatsappStatus.nonDemande.code
                : code;
            if (whatsappStatus != WhatsappStatus.autreNumero.code) {
              whatsapp.clear();
            }
          }),
        ),
        CpiReveal(
          visible: whatsappStatus == WhatsappStatus.autreNumero.code,
          child: Padding(
            padding: const EdgeInsets.only(top: CpiSpacing.sm),
            child: PhoneField(
              controller: whatsapp,
              label: 'Numéro WhatsApp',
              onChanged: (String _) => setState(() {}),
            ),
          ),
        ),
        const SizedBox(height: CpiSpacing.md),
        CpiField(
          label: 'Établissement',
          controller: etablissement,
          hint: 'Ex. Lycée Blaise Diagne',
          textCapitalization: TextCapitalization.words,
          onChanged: (String _) => setState(() {}),
        ),
        const SizedBox(height: CpiSpacing.md),
        LocalTypeahead(
          controller: profession,
          focusNode: professionFocus,
          label: 'Profession',
          hint: 'Instituteur, Proviseur, Inspecteur…',
          selectedId: professionId,
          freeText: true,
          maxLength: kProfessionMaxLength,
          options: kProfessionsFrequentes
              .map((String m) => TypeaheadOption(id: m, label: m))
              .toList(growable: false),
          onChanged: (String _) => setState(() => professionId = null),
          onSelected: (TypeaheadOption o) =>
              setState(() => professionId = o.id),
        ),
        const SizedBox(height: CpiSpacing.md),
        _champSyndicat(),
        const SizedBox(height: CpiSpacing.md),
        LocalTypeahead(
          controller: departement,
          focusNode: departementFocus,
          label: 'Département',
          hint: 'Dakar, Thiès, Mbour…',
          selectedId: departementId,
          emptyHint: departements.isEmpty
              ? 'La liste n\'est pas encore arrivée.'
              : 'Aucun résultat',
          options: departements
              .map(
                (Departement d) => TypeaheadOption(
                  id: d.id,
                  label: d.name,
                  secondary: d.code,
                  keywords: <String>[d.code],
                ),
              )
              .toList(growable: false),
          onChanged: (String _) {
            if (departementId != null) setState(() => departementId = null);
          },
          onSelected: (TypeaheadOption o) => setState(() {
            departementId = o.id;
            iefId = null;
            ief.text = '';
          }),
        ),
        const SizedBox(height: CpiSpacing.md),
        LocalTypeahead(
          controller: ief,
          focusNode: iefFocus,
          label: 'Inspection (facultatif)',
          hint: 'Almadies, Grand Dakar, Thiaroye…',
          selectedId: iefId,
          textInputAction: TextInputAction.done,
          emptyHint: iefs.isEmpty
              ? 'Aucune inspection pour ce département.'
              : 'Aucun résultat',
          options: iefs
              .map(
                (Ief i) => TypeaheadOption(
                  id: i.id,
                  label: i.name,
                  secondary: i.departementName,
                  keywords: <String>[i.code, i.departementName],
                ),
              )
              .toList(growable: false),
          onChanged: (String _) {
            if (iefId != null) setState(() => iefId = null);
          },
          onSelected: (TypeaheadOption o) => setState(() => iefId = o.id),
        ),
      ],
    );
  }

  /// Un état ajouté côté serveur garde sa puce : le faire disparaître le
  /// rétrograderait en silence au premier enregistrement.
  List<String> get _codesWhatsapp => <String>[
    WhatsappStatus.memeNumero.code,
    WhatsappStatus.autreNumero.code,
    WhatsappStatus.aucun.code,
    if (WhatsappStatus.parse(whatsappStatus) == null) whatsappStatus,
  ];

  /// Étape 4 : ce que l'appel apprend, et que la fiche ne portait pas.
  Widget _corpsRenseignements(ThemeData theme) => ListView(
    padding: _marge,
    children: <Widget>[
      _OuiNon(
        label: 'Avez-vous été contacté ?',
        value: aEteContacte,
        onChanged: (bool value) => setState(() => aEteContacte = value),
      ),
      const SizedBox(height: CpiSpacing.md),
      _OuiNon(
        label: 'Connaissez-vous l\'UES ?',
        value: connaitUES,
        onChanged: (bool value) => setState(() => connaitUES = value),
      ),
      const SizedBox(height: CpiSpacing.md),
      _OuiNon(
        label: kQuestionCHUES,
        value: representantCHUES,
        onChanged: (bool value) => setState(() => representantCHUES = value),
      ),
    ],
  );

  /// Syndicat pris dans le référentiel plutôt qu'en texte libre : la liste
  /// redescend avec le reste et se cherche par nom ou sigle.
  Widget _champSyndicat() {
    final List<Syndicat> syndicats =
        ref.watch(syndicatsProvider).value ?? const <Syndicat>[];
    return LocalTypeahead(
      controller: syndicatNom,
      focusNode: syndicatFocus,
      label: 'Syndicat (facultatif)',
      hint: 'Ex. SAEMSS',
      selectedId: syndicatId,
      textInputAction: TextInputAction.done,
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
        if (syndicatId != null) setState(() => syndicatId = null);
      },
      onSelected: (TypeaheadOption o) => setState(() => syndicatId = o.id),
    );
  }

  /// Dernière étape : l'heure du rappel si le statut la demande, la personne
  /// proposée sur un refus, le commentaire, et la relecture de ce qui part.
  Widget _corpsFin(
    ThemeData theme,
    RepresentantSyncViewData? representant,
  ) => ListView(
    padding: _marge,
    children: <Widget>[
      if (dateDemandee) ...<Widget>[
        CallbackPicker(
          now: DateTime.now(),
          required: true,
          title: reessai ? 'Réessayer quand ?' : null,
          initial: rappelAt,
          onChanged: (DateTime? at) => setState(() => rappelAt = at),
        ),
        const SizedBox(height: CpiSpacing.lg),
      ],
      // Un non n'est pas une impasse : la personne connaît souvent quelqu'un
      // à appeler à sa place, et c'est là qu'elle le dit.
      if (proposeQuelquUn) ...<Widget>[
        _PersonneProposee(
          theme: theme,
          telephone: suggestionTelephone,
          nom: suggestionNom,
          note: suggestionNote,
          onChanged: () => setState(() {}),
        ),
        const SizedBox(height: CpiSpacing.lg),
      ],
      CpiField(
        label: motifExige ? 'Motif' : 'Commentaire (facultatif)',
        controller: commentaire,
        hint: 'En une phrase',
        maxLength: 2000,
        maxLines: 3,
        textCapitalization: TextCapitalization.sentences,
        onChanged: (String _) => setState(() {}),
      ),
      const SizedBox(height: CpiSpacing.lg),
      CpiRecap(lines: recapDe(representant)),
    ],
  );
}

/// La personne proposée à la place de celle qui vient de dire non.
class _PersonneProposee extends StatelessWidget {
  const _PersonneProposee({
    required this.theme,
    required this.telephone,
    required this.nom,
    required this.note,
    required this.onChanged,
  });

  final ThemeData theme;
  final TextEditingController telephone;
  final TextEditingController nom;
  final TextEditingController note;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      Semantics(
        header: true,
        child: Text(
          'Il propose quelqu\'un d\'autre ? (facultatif)',
          style: theme.textTheme.titleSmall,
        ),
      ),
      const SizedBox(height: CpiSpacing.sm),
      PhoneField(
        controller: telephone,
        label: 'Son numéro',
        onChanged: (String _) => onChanged(),
      ),
      // Sans numéro, le serveur jette le nom et la remarque : les demander
      // d'abord faisait saisir pour rien.
      CpiReveal(
        visible: telephone.text.trim().isNotEmpty,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            const SizedBox(height: CpiSpacing.sm),
            CpiField(
              label: 'Son nom et prénom (facultatif)',
              controller: nom,
              hint: 'Ex. Fatou Sarr',
              onChanged: (String _) => onChanged(),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: CpiSpacing.sm),
            CpiField(
              label: 'Sa remarque (facultatif)',
              controller: note,
              hint: 'Ex. Déléguée du personnel',
              onChanged: (String _) => onChanged(),
              maxLines: 3,
              maxLength: 2000,
              textCapitalization: TextCapitalization.sentences,
            ),
          ],
        ),
      ),
    ],
  );
}

/// Question à une seule réponse, en tuiles : la cible tactile fait toute la
/// largeur, ce qu'un appel debout et à une main réclame.
class _ChoixUnique<T> extends StatelessWidget {
  const _ChoixUnique({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    required this.options,
    this.showLabel = true,
  });

  final String label;
  final T? value;
  final ValueChanged<T> onChanged;
  final List<(T, String)> options;
  final bool showLabel;

  @override
  Widget build(BuildContext context) => CpiChoiceGroup<T>(
    label: label,
    showLabel: showLabel,
    value: value,
    options: <CpiChoice<T>>[
      for (final (T option, String titre) in options)
        CpiChoice<T>(value: option, label: titre),
    ],
    // Une tuile déjà choisie que l'on retouche ne vide pas la réponse : la
    // question reste posée tant qu'une autre n'est pas prise.
    onChanged: (T choisi) {
      if (choisi != value) onChanged(choisi);
    },
  );
}

class _OuiNon extends StatelessWidget {
  const _OuiNon({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool? value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => _ChoixUnique<bool>(
    label: label,
    value: value,
    onChanged: onChanged,
    options: const <(bool, String)>[(true, 'Oui'), (false, 'Non')],
  );
}
