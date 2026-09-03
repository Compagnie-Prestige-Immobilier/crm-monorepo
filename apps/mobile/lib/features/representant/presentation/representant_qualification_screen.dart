import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/notifications/rep_callback_notifications.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../data/local/database.dart';
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

/// L'appel a abouti, ou non. Ce qu'il a donné se dit ensuite, au statut.
enum _Resultat { joignable, injoignable }

/// Les effets proposés par branche. `SCHEDULE_CALLBACK` est dans les DEUX : on
/// rappelle aussi qui on n'a pas joint.
const Set<String> _effetsJoignable = <String>{
  'REACHED',
  'REFUSED',
  'SCHEDULE_CALLBACK',
};

const Set<String> _effetsInjoignable = <String>{
  'UNREACHABLE',
  'WRONG_NUMBER',
  'SCHEDULE_CALLBACK',
};

/// Ces effets closent l'appel : le script reste posé, plus rien n'y est exigé.
/// La regle tient a l'EFFET et jamais au libelle, que l'administrateur renomme.
const Set<String> _effetsSansScript = <String>{'REFUSED', 'SCHEDULE_CALLBACK'};

/// Sans statut le script est exige en entier, comme avant que le referentiel
/// existe : c'est lui qui portait alors l'issue.
bool _scriptExige(StatutQualificationRow? statut) =>
    statut == null || !_effetsSansScript.contains(statut.effect);

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

/// L'issue d'un appareil dont le référentiel n'est pas descendu : ce que ce
/// script tirait de ses questions avant que le statut existe.
String _issueSansStatut({required bool joignable, required bool ambassadeur}) {
  if (!joignable) return 'UNREACHABLE';
  return ambassadeur ? 'REACHED' : 'REFUSED';
}

class RepresentantQualificationScreen extends ConsumerStatefulWidget {
  const RepresentantQualificationScreen({
    super.key,
    required this.representantId,
  });

  final String representantId;

  @override
  ConsumerState<RepresentantQualificationScreen> createState() =>
      _RepresentantQualificationScreenState();
}

class _RepresentantQualificationScreenState
    extends ConsumerState<RepresentantQualificationScreen> {
  final TextEditingController whatsapp = TextEditingController();
  final TextEditingController commentaire = TextEditingController();
  final TextEditingController suggestionTelephone = TextEditingController();
  final TextEditingController suggestionNom = TextEditingController();
  final TextEditingController suggestionNote = TextEditingController();
  final TextEditingController nouvelEtablissement = TextEditingController();
  final TextEditingController syndicatNom = TextEditingController();
  final FocusNode syndicatFocus = FocusNode();
  _Resultat? resultat;
  StatutQualificationRow? statutChoisi;
  bool? etablissementConfirme;
  bool? aEteContacte;
  bool? connaitUES;
  String? syndicatId;
  bool? ambassadeur;
  bool? memeNumeroWhatsapp;
  DateTime? rappelAt;
  bool saving = false;
  bool alreadyQualifiedWarned = false;
  String? echec;

  /// 1 : ce que l'appel a donné. 2 : ce qu'il reste à dire, et l'envoi.
  int etape = 1;

  static const int etapes = 2;

  static const List<String> questions = <String>[
    'Comment s\'est passé l\'appel ?',
    'Quelque chose à ajouter ?',
  ];

  @override
  void dispose() {
    whatsapp.dispose();
    commentaire.dispose();
    suggestionTelephone.dispose();
    suggestionNom.dispose();
    suggestionNote.dispose();
    nouvelEtablissement.dispose();
    syndicatNom.dispose();
    syndicatFocus.dispose();
    super.dispose();
  }

  /// Une personne proposée à la place de celle qu'on vient d'appeler : elle
  /// n'a de sens que si le représentant n'est pas ambassadeur.
  bool get proposeQuelquUn =>
      resultat == _Resultat.joignable && ambassadeur == false;

  /// Les statuts que la branche choisie propose, dans l'ordre servi. Lu SOUS
  /// `build` : `ref.watch` est ce qui fait reparaître la liste quand la
  /// synchronisation la ramène.
  List<StatutQualificationRow> get statutsProposes {
    final _Resultat? choix = resultat;
    if (choix == null) return const <StatutQualificationRow>[];
    final Set<String> admis = choix == _Resultat.joignable
        ? _effetsJoignable
        : _effetsInjoignable;
    final List<StatutQualificationRow> tous =
        ref.watch(statutsQualificationProvider).value ??
        const <StatutQualificationRow>[];
    return tous
        .where((StatutQualificationRow s) => admis.contains(s.effect))
        .toList(growable: false);
  }

  /// Le numéro seul ouvre la suggestion : le nom et la remarque ne se saisissent
  /// qu'après lui, et le serveur les jette sans numéro.
  bool get suggestionCommencee => suggestionTelephone.text.trim().isNotEmpty;

  /// [context] est pris SOUS la coque : le message passe par son `FToaster`.
  void erreur(BuildContext context, String message) =>
      cpiToast(context, message);

  /// Ce qui retient la première étape, dans l'ordre : le résultat, le statut,
  /// le script s'il est encore exigé, puis l'heure du rappel. Le statut passe
  /// avant le script parce que c'est lui qui dit ce que le script exige.
  String? get manqueResultat {
    final _Resultat? choix = resultat;
    if (choix == null) return 'Choisissez d\'abord le résultat';
    final StatutQualificationRow? statut = statutChoisi;
    // Le référentiel n'est pas encore descendu : la qualification reste
    // possible sans lui, comme sur un appareil qui ne le connaît pas.
    if (statut == null && statutsProposes.isNotEmpty) {
      return 'Choisissez un statut';
    }
    if (choix == _Resultat.joignable && _scriptExige(statut)) {
      final String? manquant = manqueJoignable;
      if (manquant != null) return manquant;
    }
    if ((statut?.requiresCallback ?? false) && rappelAt == null) {
      return 'Choisissez quand rappeler';
    }
    if (proposeQuelquUn &&
        suggestionCommencee &&
        Phone.parse(suggestionTelephone.text) is! PhoneValid) {
      return 'Numéro de la personne proposée incomplet';
    }
    return null;
  }

  /// Les six questions de la branche joignable, dans l'ordre du script.
  String? get manqueJoignable {
    if (etablissementConfirme == null) {
      return 'Confirmez l\'établissement';
    }
    if (etablissementConfirme == false &&
        nouvelEtablissement.text.trim().isEmpty) {
      return 'Écrivez le nouvel établissement';
    }
    if (aEteContacte == null) return 'Dites s\'il a été contacté';
    if (connaitUES == null) return 'Dites s\'il connaît l\'UES';
    if (ambassadeur == null) return 'Dites s\'il est ambassadeur';
    if (ambassadeur != true) return null;
    if (memeNumeroWhatsapp == null) {
      return 'Dites s\'il a WhatsApp sur ce numéro';
    }
    if (memeNumeroWhatsapp == false &&
        Phone.parse(whatsapp.text) is! PhoneValid) {
      return 'Écrivez le numéro WhatsApp';
    }
    return null;
  }

  /// Ce qui manque encore pour enregistrer, dit en une phrase. Null quand la
  /// réponse est complète : le bouton s'allume alors.
  String? get manque => manqueResultat;

  static String? _ouiNon(bool? value) =>
      value == null ? null : (value ? 'Oui' : 'Non');

  List<CpiRecapLine> recapDe(
    RepresentantSyncViewData? representant,
  ) => <CpiRecapLine>[
    CpiRecapLine('Personne appelée', representant?.fullName),
    CpiRecapLine(
      'Téléphone',
      representant == null ? null : Phone.format(representant.phoneE164),
    ),
    CpiRecapLine('Résultat', switch (resultat) {
      _Resultat.joignable => 'Joignable',
      _Resultat.injoignable => 'Injoignable',
      null => null,
    }),
    if (resultat == _Resultat.joignable) ...<CpiRecapLine>[
      CpiRecapLine('Établissement confirmé', _ouiNon(etablissementConfirme)),
      if (etablissementConfirme == false &&
          nouvelEtablissement.text.trim().isNotEmpty)
        CpiRecapLine('Nouvel établissement', nouvelEtablissement.text.trim()),
      CpiRecapLine('A été contacté', _ouiNon(aEteContacte)),
      CpiRecapLine('Connaît l\'UES', _ouiNon(connaitUES)),
      if (syndicatNom.text.trim().isNotEmpty)
        CpiRecapLine('Syndicat', syndicatNom.text.trim()),
      CpiRecapLine('Ambassadeur', _ouiNon(ambassadeur)),
    ],
    if (proposeQuelquUn && suggestionCommencee)
      CpiRecapLine(
        'Personne proposée',
        <String>[
          Phone.format(Phone.toE164(suggestionTelephone.text) ?? ''),
          suggestionNom.text.trim(),
        ].where((String s) => s.isNotEmpty).join(' · '),
      ),
    CpiRecapLine('Statut', statutChoisi?.label),
    if (rappelAt != null)
      CpiRecapLine('Rappel', quandRappeler(context, rappelAt!, DateTime.now())),
    if (commentaire.text.trim().isNotEmpty)
      CpiRecapLine('Commentaire', commentaire.text.trim()),
  ];

  bool get aSaisi =>
      resultat != null ||
      commentaire.text.trim().isNotEmpty ||
      nouvelEtablissement.text.trim().isNotEmpty ||
      syndicatNom.text.trim().isNotEmpty ||
      suggestionCommencee;

  Future<void> quitter() async {
    if (!aSaisi) {
      popOrHome(context);
      return;
    }
    final bool? partir = await cpiConfirm(
      context,
      title: 'Quitter sans enregistrer ?',
      message: 'Votre réponse et votre commentaire seront perdus.',
      confirmLabel: 'Quitter',
      danger: true,
    );
    if (partir != true || !mounted) return;
    popOrHome(context);
  }

  Future<void> avertirDejaQualifie(String titre) async {
    final bool? continuer = await cpiConfirm(
      context,
      title: titre,
      message: 'Voulez-vous quand même consigner un nouvel appel ?',
      confirmLabel: 'Continuer',
    );
    if (!mounted) return;
    if (continuer != true) {
      Navigator.of(context).pop();
    }
  }

  /// Une relation déjà tranchée — acceptée ou refusée — se signale avant toute
  /// saisie : rappeler quelqu'un qui a dit non se fait sciemment.
  void maybeWarnAlreadyQualified(RepresentantSyncViewData? representant) {
    if (alreadyQualifiedWarned) return;
    final String? titre = switch (representant?.relationStatus) {
      'AMBASSADEUR' =>
        'Cette personne a déjà accepté d\'être représentant CPI CHUES.',
      'REFUS' => 'Cette personne a déjà refusé.',
      _ => null,
    };
    if (titre == null) return;
    alreadyQualifiedWarned = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(avertirDejaQualifie(titre));
    });
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
    // Le bouton ne s'allume que quand `manqueResultat` est nul ; ce garde-fou
    // ne fait que nommer, sous la coque, la première question restée sans
    // réponse si l'écriture est déclenchée autrement.
    final String? manquant = manqueResultat;
    if (manquant != null) {
      erreur(context, manquant);
      return;
    }
    final bool joignable = choix == _Resultat.joignable;
    final bool ambassadeurOui = joignable && ambassadeur == true;

    // Sans statut, l'issue reste celle que ce script tirait de ses questions :
    // c'est ce que consigne un appareil dont le référentiel n'est pas descendu.
    final StatutQualificationRow? statut = statutChoisi;
    final String issue =
        (statut == null ? null : issueDuStatut(statut.effect)) ??
        _issueSansStatut(joignable: joignable, ambassadeur: ambassadeurOui);

    final String? moi = ref.read(authControllerProvider).userId;

    String? whatsappE164;
    if (ambassadeurOui && memeNumeroWhatsapp == false) {
      whatsappE164 = (Phone.parse(whatsapp.text) as PhoneValid).e164;
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
      final String attemptId = await ref
          .read(writeRepositoryProvider)
          .recordRepCallAttempt(
            representantId: widget.representantId,
            createdById: moi,
            outcome: issue,
            statutQualificationId: statut?.id,
            // Une question sans réponse n'est pas un refus : le statut la pose
            // désormais facultative, et le serveur comble ce silence lui-même.
            relationStatus: !joignable || ambassadeur == null
                ? null
                : (ambassadeurOui ? 'AMBASSADEUR' : 'REFUS'),
            whatsappStatus: ambassadeurOui
                ? (memeNumeroWhatsapp! ? 'MEME_NUMERO' : 'AUTRE_NUMERO')
                : null,
            whatsappE164: whatsappE164,
            comment: commentaire.text,
            callbackAt: rappelAt,
            // Les renseignements 1–4 se prennent sur tout appel joignable,
            // ambassadeur ou non : ce sont des renseignements, pas une branche.
            etablissementConfirme: joignable ? etablissementConfirme : null,
            etablissementSaisi: joignable ? nouvelEtablissement.text : null,
            contacte: joignable ? aEteContacte : null,
            connaitUES: joignable ? connaitUES : null,
            syndicat: joignable ? syndicatNom.text : null,
            // Seulement quand la personne appelée n'est pas ambassadeur :
            // ailleurs, la question de la remplaçante n'a pas été posée.
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
      if (context.mounted) Navigator.of(context).pop();
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
    maybeWarnAlreadyQualified(representant);
    final String? manque = this.manque;
    final bool premiere = etape == 1;

    return CpiStepScope(
      first: premiere,
      onExit: () => unawaited(quitter()),
      onBack: saving ? null : () => setState(() => etape = 1),
      child: CpiScaffold(
        title: questions[etape - 1],
        showTitle: false,
        leading: CpiHeaderAction(
          icon: PhosphorIconsRegular.arrowLeft,
          label: premiere ? 'Retour' : 'Étape précédente',
          onPressed: premiere
              ? () => unawaited(quitter())
              : (saving ? null : () => setState(() => etape = 1)),
        ),
        banner: echec == null
            ? null
            : CpiStatusBand(
                text: echec!,
                tone: CpiTone.danger,
                actionLabel: 'Réessayer',
                onAction: () => unawaited(enregistrer(context)),
              ),
        footer: CpiActionBar(
          child: premiere
              ? CpiButton(
                  'Continuer',
                  icon: PhosphorIconsRegular.arrowRight,
                  subtitle: manqueResultat,
                  onPressed: manqueResultat == null
                      ? () => setState(() => etape = 2)
                      : null,
                )
              : Builder(
                  builder: (BuildContext context) => CpiButton(
                    'Enregistrer',
                    loading: saving,
                    subtitle: manque,
                    onPressed: manque == null
                        ? () => unawaited(enregistrer(context))
                        : null,
                  ),
                ),
        ),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            CpiStepHeader(
              step: etape,
              total: etapes,
              question: questions[etape - 1],
            ),
            Expanded(
              child: premiere
                  ? _corpsResultat(theme, representant)
                  : _corpsDetails(theme, representant),
            ),
          ],
        ),
      ),
    );
  }

  /// Étape 1 : le résultat de l'appel et ce qu'il entraîne aussitôt.
  Widget _corpsResultat(
    ThemeData theme,
    RepresentantSyncViewData? representant,
  ) => ListView(
    padding: const EdgeInsets.fromLTRB(
      CpiSpacing.md,
      0,
      CpiSpacing.md,
      CpiSpacing.md,
    ),
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
                <String>[
                  Phone.format(representant.phoneE164),
                  ?representant.etablissement,
                ].where((String s) => s.isNotEmpty).join(' · '),
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
        label: questions[0],
        showLabel: false,
        value: resultat,
        // Le statut et son heure repartent de zéro : les deux branches ne
        // proposent pas les mêmes, et celui qu'on quitte laisserait sinon sa
        // date derrière lui.
        onChanged: (_Resultat choix) => setState(() {
          resultat = choix;
          statutChoisi = null;
          rappelAt = null;
        }),
        options: const <(_Resultat, String)>[
          (_Resultat.joignable, 'Joignable'),
          (_Resultat.injoignable, 'Injoignable'),
        ],
      ),
      if (resultat == _Resultat.joignable) ...<Widget>[
        const SizedBox(height: CpiSpacing.lg),
        // 1. L'établissement en fiche est-il le bon ?
        _OuiNon(
          label: 'Confirmer l\'établissement ?',
          value: etablissementConfirme,
          onChanged: (bool value) =>
              setState(() => etablissementConfirme = value),
        ),
        CpiReveal(
          visible: etablissementConfirme == false,
          child: Padding(
            padding: const EdgeInsets.only(top: CpiSpacing.sm),
            child: CpiField(
              label: 'Nouvel établissement',
              controller: nouvelEtablissement,
              hint: 'Ex. Lycée Blaise Diagne',
              onChanged: (String _) => setState(() {}),
              textCapitalization: TextCapitalization.words,
            ),
          ),
        ),
        // 2. A-t-il déjà été contacté ?
        const SizedBox(height: CpiSpacing.md),
        _OuiNon(
          label: 'Avez-vous été contacté ?',
          value: aEteContacte,
          onChanged: (bool value) => setState(() => aEteContacte = value),
        ),
        // 3. Connaît-il l'UES ?
        const SizedBox(height: CpiSpacing.md),
        _OuiNon(
          label: 'Connaissez-vous l\'UES ?',
          value: connaitUES,
          onChanged: (bool value) => setState(() => connaitUES = value),
        ),
        // 4. Sur quel syndicat ? Choisi dans le référentiel, FACULTATIF.
        const SizedBox(height: CpiSpacing.md),
        _champSyndicat(),
        // 5. Ambassadeur : c'est l'ancien « représentant CPI CHUES », mapping
        // outcome/relationStatus inchangé.
        const SizedBox(height: CpiSpacing.md),
        _OuiNon(
          label: 'Ambassadeur ?',
          value: ambassadeur,
          onChanged: (bool value) => setState(() {
            ambassadeur = value;
            if (!value) memeNumeroWhatsapp = null;
          }),
        ),
        // WhatsApp ne se pose qu'à un ambassadeur : sur un non, la fiche ferme
        // en REFUS et l'on passe à la personne proposée.
        if (ambassadeur == true) ...<Widget>[
          // 6. WhatsApp sur le numéro en fiche ?
          const SizedBox(height: CpiSpacing.md),
          _OuiNon(
            label: 'A-t-il WhatsApp sur ce numéro ?',
            value: memeNumeroWhatsapp,
            onChanged: (bool value) =>
                setState(() => memeNumeroWhatsapp = value),
          ),
          CpiReveal(
            visible: memeNumeroWhatsapp == false,
            child: Padding(
              padding: const EdgeInsets.only(top: CpiSpacing.sm),
              child: PhoneField(
                controller: whatsapp,
                label: 'Numéro WhatsApp',
                onChanged: (String _) => setState(() {}),
              ),
            ),
          ),
        ],
        // Un non n'est pas une impasse : la personne connaît souvent quelqu'un
        // à appeler à sa place, et c'est là qu'elle le dit.
        CpiReveal(
          visible: proposeQuelquUn,
          child: Padding(
            padding: const EdgeInsets.only(top: CpiSpacing.lg),
            child: _PersonneProposee(
              theme: theme,
              telephone: suggestionTelephone,
              nom: suggestionNom,
              note: suggestionNote,
              onChanged: () => setState(() {}),
            ),
          ),
        ),
      ],
      // Le statut se pose EN DERNIER : il résume l'appel, et il ne se choisit
      // bien qu'une fois les questions posées. Rien à montrer tant que le
      // référentiel n'est pas descendu.
      if (statutsProposes.isNotEmpty) ...<Widget>[
        const SizedBox(height: CpiSpacing.lg),
        _ChoixUnique<StatutQualificationRow>(
          label: 'Statut de qualification',
          value: statutChoisi,
          onChanged: (StatutQualificationRow statut) => setState(() {
            statutChoisi = statut;
            rappelAt = null;
          }),
          options: <(StatutQualificationRow, String)>[
            for (final StatutQualificationRow s in statutsProposes)
              (s, s.label),
          ],
        ),
      ],
      if (statutChoisi?.requiresCallback ?? false) ...<Widget>[
        const SizedBox(height: CpiSpacing.lg),
        CallbackPicker(
          now: DateTime.now(),
          required: true,
          onChanged: (DateTime? at) => setState(() => rappelAt = at),
        ),
      ],
      if (resultat != null) ...<Widget>[
        const SizedBox(height: CpiSpacing.lg),
        CpiField(
          label: 'Commentaire (facultatif)',
          controller: commentaire,
          hint: 'En une phrase',
          maxLength: 2000,
          maxLines: 3,
          textCapitalization: TextCapitalization.sentences,
          onChanged: (String _) => setState(() {}),
        ),
      ],
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

  /// Étape 2 : la relecture de ce qui part. Le commentaire se saisit à l'étape
  /// de qualification, sous les questions.
  Widget _corpsDetails(
    ThemeData theme,
    RepresentantSyncViewData? representant,
  ) => ListView(
    padding: const EdgeInsets.fromLTRB(
      CpiSpacing.md,
      0,
      CpiSpacing.md,
      CpiSpacing.md,
    ),
    children: <Widget>[CpiRecap(lines: recapDe(representant))],
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
