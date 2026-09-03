import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/notifications/rep_callback_notifications.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../core/utils/relative_time.dart';
import '../../../core/utils/whatsapp.dart';
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
import 'representant_detail_screen.dart'
    show StatutTag, libelleIssueRepresentant;

/// L'appel a abouti, ou non. Ce qu'il a donné se dit ensuite, au statut.
enum _Resultat { joignable, injoignable }

/// La fiche avant d'appeler, le résultat et son statut, les renseignements si
/// le statut les exige encore, puis le rappel, le commentaire et l'envoi.
enum _Etape { fiche, resultat, renseignements, fin }

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

/// Ces effets closent l'appel : les renseignements ne sont plus demandés.
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
  String? echec;

  _Etape etape = _Etape.fiche;
  bool enAvant = true;

  static const Map<_Etape, String> questions = <_Etape, String>{
    _Etape.fiche: 'Avant l\'appel',
    _Etape.resultat: 'Comment s\'est passé l\'appel ?',
    _Etape.renseignements: 'Ce qu\'il vous a dit',
    _Etape.fin: 'Pour finir',
  };

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
  /// n'a de sens que sur un refus, dit par le statut ou par l'ambassadeur.
  bool get proposeQuelquUn =>
      resultat == _Resultat.joignable &&
      (statutChoisi?.effect == 'REFUSED' ||
          (renseignementsExiges && ambassadeur == false));

  /// Un « à rappeler » ou un refus se consigne sans les six questions : elles
  /// ne sont posées qu'à qui a accepté de parler.
  bool get renseignementsExiges =>
      resultat == _Resultat.joignable && _scriptExige(statutChoisi);

  List<_Etape> get parcours => <_Etape>[
    _Etape.fiche,
    _Etape.resultat,
    if (renseignementsExiges) _Etape.renseignements,
    _Etape.fin,
  ];

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

  /// Ce qui retient une étape, dit en une phrase. Null : on peut avancer.
  String? manqueEtape(_Etape e) => switch (e) {
    _Etape.fiche => null,
    _Etape.resultat => manqueResultat,
    _Etape.renseignements => manqueRenseignements,
    _Etape.fin => manqueFin,
  };

  String? get manqueFin {
    if ((statutChoisi?.requiresCallback ?? false) && rappelAt == null) {
      return 'Choisissez quand rappeler';
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
    // Le référentiel n'est pas encore descendu : la qualification reste
    // possible sans lui, comme sur un appareil qui ne le connaît pas.
    if (statutChoisi == null && statutsProposes.isNotEmpty) {
      return 'Choisissez un statut';
    }
    return null;
  }

  /// Les six questions de la branche joignable, dans l'ordre du script.
  String? get manqueRenseignements {
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
    if (ambassadeur == true) {
      if (memeNumeroWhatsapp == null) {
        return 'Dites s\'il a WhatsApp sur ce numéro';
      }
      if (memeNumeroWhatsapp == false &&
          Phone.parse(whatsapp.text) is! PhoneValid) {
        return 'Écrivez le numéro WhatsApp';
      }
    }
    return null;
  }

  /// Ce qui manque encore pour enregistrer, toutes étapes confondues. Null
  /// quand la réponse est complète : le bouton s'allume alors.
  String? get manque =>
      manqueResultat ??
      (renseignementsExiges ? manqueRenseignements : null) ??
      manqueEtape(_Etape.fin);

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
    if (renseignementsExiges) ...<CpiRecapLine>[
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

  void suivant() {
    final List<_Etape> etapes = parcours;
    final int index = etapes.indexOf(etape);
    if (index + 1 >= etapes.length) return;
    setState(() {
      enAvant = true;
      etape = etapes[index + 1];
    });
  }

  void precedent() {
    final List<_Etape> etapes = parcours;
    final int index = etapes.indexOf(etape);
    if (index <= 0) {
      unawaited(quitter());
      return;
    }
    setState(() {
      enAvant = false;
      etape = etapes[index - 1];
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
    // Le bouton ne s'allume que quand `manque` est nul ; ce garde-fou ne fait
    // que nommer, sous la coque, la première question restée sans réponse si
    // l'écriture est déclenchée autrement.
    final String? manquant = manque;
    if (manquant != null) {
      erreur(context, manquant);
      return;
    }
    final bool joignable = choix == _Resultat.joignable;
    final bool renseigne = renseignementsExiges;
    final bool ambassadeurOui = renseigne && ambassadeur == true;

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
            relationStatus: !renseigne || ambassadeur == null
                ? null
                : (ambassadeurOui ? 'AMBASSADEUR' : 'REFUS'),
            whatsappStatus: ambassadeurOui
                ? (memeNumeroWhatsapp! ? 'MEME_NUMERO' : 'AUTRE_NUMERO')
                : null,
            whatsappE164: whatsappE164,
            comment: commentaire.text,
            callbackAt: rappelAt,
            // Les renseignements 1–4 se prennent sur tout appel joignable qui
            // les a exigés, ambassadeur ou non : ce sont des renseignements,
            // pas une branche.
            etablissementConfirme: renseigne ? etablissementConfirme : null,
            etablissementSaisi: renseigne ? nouvelEtablissement.text : null,
            contacte: renseigne ? aEteContacte : null,
            connaitUES: renseigne ? connaitUES : null,
            syndicat: renseigne ? syndicatNom.text : null,
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
    final List<_Etape> etapes = parcours;
    final bool premiere = etape == _Etape.fiche;
    final String question = questions[etape]!;

    return CpiStepScope(
      first: premiere,
      onExit: () => unawaited(quitter()),
      onBack: saving ? null : precedent,
      child: CpiScaffold(
        title: question,
        showTitle: false,
        leading: CpiHeaderAction(
          icon: PhosphorIconsRegular.arrowLeft,
          label: premiere ? 'Retour' : 'Étape précédente',
          onPressed: saving ? null : precedent,
        ),
        banner: echec == null
            ? null
            : CpiStatusBand(
                text: echec!,
                tone: CpiTone.danger,
                actionLabel: 'Réessayer',
                onAction: () => unawaited(enregistrer(context)),
              ),
        footer: CpiActionBar(child: _pied(context)),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
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
                _Etape.renseignements => _corpsRenseignements(theme),
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
    _Etape.resultat || _Etape.renseignements => CpiButton(
      'Continuer',
      icon: PhosphorIconsRegular.arrowRight,
      subtitle: manqueEtape(etape),
      onPressed: manqueEtape(etape) == null ? suivant : null,
    ),
    _Etape.fin => Builder(
      builder: (BuildContext context) => CpiButton(
        'Enregistrer',
        loading: saving,
        subtitle: manque,
        onPressed: manque == null ? () => unawaited(enregistrer(context)) : null,
      ),
    ),
  };

  static EdgeInsets get _marge => const EdgeInsets.fromLTRB(
    CpiSpacing.md,
    0,
    CpiSpacing.md,
    CpiSpacing.md,
  );

  /// Étape 1 : la fiche telle qu'elle est, avant de composer le numéro.
  Widget _corpsFiche(ThemeData theme, RepresentantSyncViewData? representant) {
    if (representant == null) {
      return const Center(child: FCircularProgress(semanticsLabel: 'Chargement'));
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
            ),
          ],
        ),
        const SizedBox(height: CpiSpacing.sm),
        CpiCard.rows(<CpiRow>[
          CpiRow(title: 'Nom', subtitle: nom),
          CpiRow(
            title: 'Téléphone',
            subtitle: Phone.format(representant.phoneE164),
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
      ],
    );
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
        }),
        options: const <(_Resultat, String)>[
          (_Resultat.joignable, 'Joignable'),
          (_Resultat.injoignable, 'Injoignable'),
        ],
      ),
      // Rien à montrer tant que le référentiel n'est pas descendu.
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
    ],
  );

  /// Étape 3 : les six questions du script, et la personne proposée.
  Widget _corpsRenseignements(ThemeData theme) => ListView(
    padding: _marge,
    children: <Widget>[
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
      if (statutChoisi?.requiresCallback ?? false) ...<Widget>[
        CallbackPicker(
          now: DateTime.now(),
          required: true,
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
        label: 'Commentaire (facultatif)',
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
