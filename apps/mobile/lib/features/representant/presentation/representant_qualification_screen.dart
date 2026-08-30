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
import '../../../ui/widgets/phone_field.dart';
import '../../permissions/alarme_permission.dart';
import '../../phase2/presentation/callback_picker.dart';

enum _Resultat { joignable, rappel, injoignable }

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
  _Resultat? resultat;
  bool? representantCpi;
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
    super.dispose();
  }

  /// Une personne proposée à la place de celle qu'on vient d'appeler : elle
  /// n'a de sens que si le représentant a dit non.
  bool get proposeQuelquUn =>
      resultat == _Resultat.joignable && representantCpi == false;

  /// N'importe lequel des trois champs suffit à ouvrir la suggestion : ce que
  /// le téléconseiller a tapé ne doit pas disparaître faute de numéro.
  bool get suggestionCommencee =>
      suggestionTelephone.text.trim().isNotEmpty ||
      suggestionNom.text.trim().isNotEmpty ||
      suggestionNote.text.trim().isNotEmpty;

  /// [context] est pris SOUS la coque : le message passe par son `FToaster`.
  void erreur(BuildContext context, String message) =>
      cpiToast(context, message);

  /// Ce qui retient la première étape : le résultat et ce qu'il entraîne.
  String? get manqueResultat {
    final _Resultat? choix = resultat;
    if (choix == null) return 'Choisissez d\'abord le résultat';
    if (choix == _Resultat.joignable && representantCpi == null) {
      return 'Dites s\'il est représentant CPI CHUES';
    }
    if (choix == _Resultat.joignable &&
        representantCpi == true &&
        memeNumeroWhatsapp == null) {
      return 'Dites s\'il a WhatsApp sur ce numéro';
    }
    if (choix == _Resultat.joignable &&
        representantCpi == true &&
        memeNumeroWhatsapp == false &&
        Phone.parse(whatsapp.text) is! PhoneValid) {
      return 'Écrivez le numéro WhatsApp';
    }
    if (choix == _Resultat.rappel && rappelAt == null) {
      return 'Choisissez quand rappeler';
    }
    if (proposeQuelquUn &&
        suggestionCommencee &&
        Phone.parse(suggestionTelephone.text) is! PhoneValid) {
      // Le serveur jette la suggestion sans numéro : mieux vaut retenir
      // l'enregistrement que perdre le nom déjà écrit.
      return suggestionTelephone.text.trim().isEmpty
          ? 'Écrivez le numéro de la personne proposée'
          : 'Numéro de la personne proposée incomplet';
    }
    return null;
  }

  /// Ce qui manque encore pour enregistrer, dit en une phrase. Null quand la
  /// réponse est complète : le bouton s'allume alors.
  String? get manque => manqueResultat;

  List<CpiRecapLine> recapDe(RepresentantSyncViewData? representant) =>
      <CpiRecapLine>[
        CpiRecapLine('Personne appelée', representant?.fullName),
        CpiRecapLine(
          'Téléphone',
          representant == null ? null : Phone.format(representant.phoneE164),
        ),
        CpiRecapLine('Résultat', switch (resultat) {
          _Resultat.joignable => 'Joignable',
          _Resultat.rappel => 'À rappeler',
          _Resultat.injoignable => 'Injoignable',
          null => null,
        }),
        if (resultat == _Resultat.joignable)
          CpiRecapLine(
            'Représentant CPI CHUES',
            representantCpi == null ? null : (representantCpi! ? 'Oui' : 'Non'),
          ),
        if (proposeQuelquUn && suggestionCommencee)
          CpiRecapLine(
            'Personne proposée',
            <String>[
              Phone.format(Phone.toE164(suggestionTelephone.text) ?? ''),
              suggestionNom.text.trim(),
            ].where((String s) => s.isNotEmpty).join(' · '),
          ),
      ];

  bool get aSaisi =>
      resultat != null ||
      commentaire.text.trim().isNotEmpty ||
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
    final _Resultat? choix = resultat;
    if (choix == null) {
      erreur(context, 'Choisissez le résultat de l’appel.');
      return;
    }
    if (choix == _Resultat.joignable && representantCpi == null) {
      erreur(context, 'Indiquez si la personne est représentant CPI CHUES.');
      return;
    }
    if (choix == _Resultat.joignable &&
        representantCpi == true &&
        memeNumeroWhatsapp == null) {
      erreur(context, 'Indiquez le compte WhatsApp.');
      return;
    }
    if (choix == _Resultat.rappel && rappelAt == null) {
      erreur(context, 'Choisissez une date de rappel.');
      return;
    }

    String? whatsappE164;
    if (choix == _Resultat.joignable &&
        representantCpi == true &&
        memeNumeroWhatsapp == false) {
      final PhoneResult parsed = Phone.parse(whatsapp.text);
      if (parsed is! PhoneValid) {
        erreur(context, 'Saisissez un numéro WhatsApp valide.');
        return;
      }
      whatsappE164 = parsed.e164;
    }

    final bool chuesOui =
        choix == _Resultat.joignable && representantCpi == true;

    // Avant l'écriture, et seulement quand un rappel est promis : c'est le
    // seul moment où la demande d'autorisation s'explique d'elle-même. Un
    // refus n'empêche jamais de consigner l'appel.
    if (rappelAt != null) {
      await demanderLAlarme(context, ref);
      if (!context.mounted) return;
    }

    setState(() {
      saving = true;
      echec = null;
    });
    try {
      final String attemptId = await ref
          .read(writeRepositoryProvider)
          .recordRepCallAttempt(
            representantId: widget.representantId,
            outcome: switch (choix) {
              _Resultat.joignable => chuesOui ? 'REACHED' : 'REFUSED',
              _Resultat.rappel => 'CALLBACK',
              _Resultat.injoignable => 'UNREACHABLE',
            },
            relationStatus: switch (choix) {
              _Resultat.joignable => chuesOui ? 'AMBASSADEUR' : 'REFUS',
              _ => null,
            },
            whatsappStatus: chuesOui
                ? (memeNumeroWhatsapp! ? 'MEME_NUMERO' : 'AUTRE_NUMERO')
                : null,
            whatsappE164: whatsappE164,
            comment: commentaire.text,
            callbackAt: rappelAt,
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
      unawaited(ref.read(syncCoordinatorProvider.notifier).run());
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
              representant?.fullName ?? 'Représentant',
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
        label: questions[0],
        showLabel: false,
        value: resultat,
        onChanged: (_Resultat choix) => setState(() => resultat = choix),
        options: const <(_Resultat, String)>[
          (_Resultat.joignable, 'Joignable'),
          (_Resultat.rappel, 'À rappeler'),
          (_Resultat.injoignable, 'Injoignable'),
        ],
      ),
      if (resultat == _Resultat.joignable) ...<Widget>[
        const SizedBox(height: CpiSpacing.lg),
        _OuiNon(
          label: 'Est-il représentant CPI CHUES ?',
          value: representantCpi,
          onChanged: (bool value) => setState(() {
            representantCpi = value;
            if (!value) memeNumeroWhatsapp = null;
          }),
        ),
        // Hors CHUES, la question WhatsApp n'a aucun sens : la fiche ferme
        // directement en REFUS sans qu'on la pose.
        if (representantCpi == true) ...<Widget>[
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
      if (resultat == _Resultat.rappel) ...<Widget>[
        const SizedBox(height: CpiSpacing.lg),
        CallbackPicker(
          now: DateTime.now(),
          required: true,
          onChanged: (DateTime? at) => setState(() => rappelAt = at),
        ),
      ],
    ],
  );

  /// Étape 2 : la personne proposée à la place, le commentaire, et la relecture
  /// de ce qui part.
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
    children: <Widget>[
      CpiField(
        label: 'Commentaire',
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
