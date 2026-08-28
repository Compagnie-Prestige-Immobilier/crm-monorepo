import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../data/repositories/visites_repository.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/local_typeahead.dart';
import '../../../ui/widgets/phone_field.dart';

/// Les huit champs d'une visite : contrôleurs, choix et reproches.
///
/// Le formulaire d'inscription et la feuille de correction affichent les mêmes
/// champs ; ils partagent donc le même état, que le premier remplit et vide au
/// fil des visiteurs et que la seconde préremplit d'une ligne du registre.
class VisiteSaisie {
  final TextEditingController nom = TextEditingController();
  final TextEditingController entreprise = TextEditingController();
  final TextEditingController destinataire = TextEditingController();
  final TextEditingController direction = TextEditingController();
  final TextEditingController objet = TextEditingController();
  final TextEditingController venuDe = TextEditingController();
  final TextEditingController telephone = TextEditingController();
  final TextEditingController note = TextEditingController();

  final FocusNode nomFocus = FocusNode();
  final FocusNode entrepriseFocus = FocusNode();
  final FocusNode destinataireFocus = FocusNode();
  final FocusNode directionFocus = FocusNode();
  final FocusNode objetFocus = FocusNode();

  String? entrepriseId;
  String? destinataireId;
  String? directionId;
  String? objetId;

  String? erreurNom;
  String? erreurEntreprise;
  String? erreurObjet;

  /// Les champs libres, pour brancher l'écriture du brouillon.
  List<TextEditingController> get champsLibres => <TextEditingController>[
    nom,
    venuDe,
    telephone,
    note,
  ];

  bool get vide =>
      nom.text.trim().isEmpty &&
      venuDe.text.trim().isEmpty &&
      telephone.text.trim().isEmpty &&
      note.text.trim().isEmpty &&
      entrepriseId == null &&
      objetId == null &&
      directionId == null &&
      destinataireId == null;

  /// Le nom, la société visitée et l'objet : rien d'autre n'est exigé, ni ici
  /// ni par le serveur.
  bool valider() {
    erreurNom = nom.text.trim().isEmpty ? 'Écrivez le nom du visiteur.' : null;
    erreurEntreprise = entrepriseId == null
        ? 'Choisissez la société visitée dans la liste.'
        : null;
    erreurObjet = objetId == null
        ? 'Choisissez l\'objet de la visite dans la liste.'
        : null;
    return erreurNom == null && erreurEntreprise == null && erreurObjet == null;
  }

  /// Le numéro est-il utilisable ? Le Sénégal par défaut, un autre pays s'il
  /// s'annonce par « + » ou « 00 ».
  bool get telephoneComplet =>
      Phone.parse(telephone.text, strictSenegal: false) is PhoneValid;

  /// Ce qui manque pour passer à l'étape suivante, en une phrase. `null` quand
  /// l'étape est complète : le bouton s'allume alors.
  String? manque(EtapeVisite etape) => switch (etape) {
    EtapeVisite.qui => switch ((nom.text.trim().isEmpty, telephoneComplet)) {
      (true, _) => 'Écrivez le nom du visiteur',
      (false, false) => 'Écrivez le numéro de téléphone',
      _ => null,
    },
    EtapeVisite.pourQui => switch ((entrepriseId, objetId)) {
      (null, null) => 'Choisissez la société visitée et l\'objet',
      (null, _) => 'Choisissez la société visitée',
      (_, null) => 'Choisissez l\'objet de la visite',
      _ => null,
    },
    EtapeVisite.note => null,
  };

  static const String _prefixeVenuDe = 'Venu de : ';
  static const String _separateur = ' · ';

  /// « Venu de » et la note tiennent dans le seul `comment` que le serveur
  /// accepte : l'employeur d'abord, préfixé, la note ensuite.
  String? get commentaire {
    final String de = venuDe.text.trim();
    final String reste = note.text.trim();
    final String assemble = <String>[
      if (de.isNotEmpty) '$_prefixeVenuDe$de',
      if (reste.isNotEmpty) reste,
    ].join(_separateur);
    return assemble.isEmpty ? null : assemble;
  }

  /// L'opération inverse, pour une visite relue : brouillon de plantage ou
  /// ligne du registre à corriger.
  void lireCommentaire(String? valeur) {
    final String texte = valeur?.trim() ?? '';
    if (!texte.startsWith(_prefixeVenuDe)) {
      venuDe.text = '';
      note.text = texte;
      return;
    }
    final String apres = texte.substring(_prefixeVenuDe.length);
    final int coupure = apres.indexOf(_separateur);
    if (coupure < 0) {
      venuDe.text = apres.trim();
      note.text = '';
      return;
    }
    venuDe.text = apres.substring(0, coupure).trim();
    note.text = apres.substring(coupure + _separateur.length).trim();
  }

  void dispose() {
    for (final TextEditingController c in <TextEditingController>[
      nom,
      entreprise,
      destinataire,
      direction,
      objet,
      venuDe,
      telephone,
      note,
    ]) {
      c.dispose();
    }
    for (final FocusNode n in <FocusNode>[
      nomFocus,
      entrepriseFocus,
      destinataireFocus,
      directionFocus,
      objetFocus,
    ]) {
      n.dispose();
    }
  }
}

/// L'intitulé du référentiel, et non celui du champ : « Vient voir » affiche
/// un titre raccourci, le registre garde l'intitulé entier.
String? labelReferentiel(List<VisiteReferentielDto> liste, String? id) {
  if (id == null) return null;
  for (final VisiteReferentielDto d in liste) {
    if (d.id == id) return d.label;
  }
  return null;
}

/// Le classeur écrit le rôle entre parenthèses, à la suite du nom :
/// « MME. DIOUM YAMA (Ass Rh et Commerciale Argile) ». Sur une ligne de 320 dp
/// il déborde ; en sous-titre il se lit.
(String, String?) titreEtRole(String label) {
  final int ouvre = label.indexOf('(');
  final int ferme = label.lastIndexOf(')');
  if (ouvre <= 0 || ferme < ouvre) return (label, null);
  final String titre = label.substring(0, ouvre).trim();
  final String role = label.substring(ouvre + 1, ferme).trim();
  if (titre.isEmpty || role.isEmpty) return (label, null);
  return (titre, role);
}

/// Les options d'une liste, les plus fréquentes en tête.
///
/// L'accueil retape les mêmes cinq valeurs toute la journée : les remonter
/// épargne un défilement à chaque visiteur. Le reste garde l'ordre du
/// référentiel, séparé de la tête pour que personne ne croie la liste finie.
List<TypeaheadOption> optionsVisite(
  List<VisiteReferentielDto> liste,
  List<LabelCompte> frequents, {
  bool roleEnSousTitre = false,
  String? sousTitreAutre,
}) {
  TypeaheadOption vers(VisiteReferentielDto d) {
    if (sousTitreAutre != null && d.label.trim().toUpperCase() == 'AUTRE') {
      return TypeaheadOption(
        id: d.id,
        label: d.label,
        secondary: sousTitreAutre,
      );
    }
    if (!roleEnSousTitre) return TypeaheadOption(id: d.id, label: d.label);
    final (String titre, String? role) = titreEtRole(d.label);
    return TypeaheadOption(
      id: d.id,
      label: titre,
      secondary: role,
      // Le rôle a quitté le libellé : il doit rester cherchable.
      keywords: <String>[d.label],
    );
  }

  // Deux entrées du même intitulé sont un défaut du classeur, pas un choix :
  // proposer les deux, c'est demander de deviner laquelle est la bonne, et
  // l'ancienne fait refuser la visite. On garde la plus récemment servie par
  // le serveur, à la place de la première.
  final Map<String, VisiteReferentielDto> uniques =
      <String, VisiteReferentielDto>{};
  for (final VisiteReferentielDto d in liste) {
    final String cle = foldSearch(d.label.trim());
    final VisiteReferentielDto? deja = uniques[cle];
    if (deja == null || d.updatedAt.isAfter(deja.updatedAt)) {
      uniques[cle] = d;
    }
  }

  final List<VisiteReferentielDto> reste = <VisiteReferentielDto>[];
  final List<VisiteReferentielDto> autre = <VisiteReferentielDto>[];
  for (final VisiteReferentielDto d in uniques.values) {
    if (sousTitreAutre != null && d.label.trim().toUpperCase() == 'AUTRE') {
      autre.add(d);
    } else {
      reste.add(d);
    }
  }

  // La tête est ce qui a SERVI sur la fenêtre, rapproché du référentiel par
  // l'intitulé : une visite écrite « Cpi » désigne bien l'entrée « CPI ».
  // Chaque entrée retenue QUITTE le reste, sans quoi elle s'afficherait deux
  // fois.
  final List<VisiteReferentielDto> tete = <VisiteReferentielDto>[];
  for (final LabelCompte compte in frequents) {
    final String cherche = foldSearch(compte.libelle.trim());
    final int index = reste.indexWhere(
      (VisiteReferentielDto d) => foldSearch(d.label.trim()) == cherche,
    );
    if (index >= 0) tete.add(reste.removeAt(index));
  }

  return <TypeaheadOption>[
    ...tete.map(vers),
    if (tete.isNotEmpty && reste.isNotEmpty)
      const TypeaheadOption.separator('Toute la liste'),
    ...reste.map(vers),
    ...autre.map(vers),
  ];
}

/// Les trois temps d'une inscription, dans l'ordre où le comptoir les vit.
enum EtapeVisite {
  qui('Qui se présente ?'),
  pourQui('Pour qui, pourquoi ?'),
  note('Une note ?');

  const EtapeVisite(this.question);

  final String question;
}

/// Les champs d'une ou plusieurs étapes.
///
/// Le formulaire n'en affiche qu'une à la fois — huit champs d'affilée, c'est
/// un mur ; la feuille de correction les demande toutes, parce qu'on y vient
/// pour relire une visite entière.
class ChampsVisite extends StatefulWidget {
  const ChampsVisite({
    super.key,
    required this.saisie,
    required this.bundle,
    required this.frequents,
    required this.onModifie,
    this.etapes = EtapeVisite.values,
    this.rappel,
    this.autofocus = false,
  });

  final VisiteSaisie saisie;
  final VisiteReferentielsBundleDto bundle;
  final TopLabels frequents;

  /// Appelé après chaque frappe et chaque choix : le formulaire y accroche
  /// l'écriture du brouillon.
  final VoidCallback onModifie;

  final List<EtapeVisite> etapes;

  /// La ligne « Déjà venu le … », sous le nom. Absente de la correction.
  final Widget? rappel;

  /// Ouvre le clavier sur le premier champ de l'étape.
  final bool autofocus;

  @override
  State<ChampsVisite> createState() => _ChampsVisiteState();
}

class _ChampsVisiteState extends State<ChampsVisite> {
  VisiteSaisie get _s => widget.saisie;

  void _change(VoidCallback mutation) {
    setState(mutation);
    widget.onModifie();
  }

  Widget _liste({
    required String cle,
    required String label,
    required String hint,
    required TextEditingController controller,
    required FocusNode focusNode,
    required List<TypeaheadOption> options,
    required String? selectedId,
    required ValueChanged<String?> onId,
    String? description,
    String? noMatchHint,
    String? error,
  }) => LocalTypeahead(
    key: ValueKey<String>(cle),
    controller: controller,
    focusNode: focusNode,
    label: label,
    hint: hint,
    description: description,
    noMatchHint: noMatchHint,
    error: error,
    selectedId: selectedId,
    freeText: false,
    options: options,
    onChanged: (String _) {
      if (selectedId != null) _change(() => onId(null));
    },
    onSelected: (TypeaheadOption option) => _change(() => onId(option.id)),
  );

  @override
  Widget build(BuildContext context) {
    final List<Widget> champs = <Widget>[
      for (final EtapeVisite etape in widget.etapes) ..._etape(etape),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        for (int i = 0; i < champs.length; i++) ...<Widget>[
          if (i > 0) const SizedBox(height: CpiSpacing.md),
          champs[i],
        ],
      ],
    );
  }

  List<Widget> _etape(EtapeVisite etape) => switch (etape) {
    EtapeVisite.qui => _qui(),
    EtapeVisite.pourQui => _pourQui(),
    EtapeVisite.note => _note(),
  };

  List<Widget> _qui() => <Widget>[
    CpiField(
      key: const ValueKey<String>('visite-nom'),
      label: 'Nom du visiteur',
      hint: 'Ex. Fatou Sarr',
      controller: _s.nom,
      focusNode: _s.nomFocus,
      autofocus: widget.autofocus,
      textCapitalization: TextCapitalization.words,
      textInputAction: TextInputAction.next,
      error: _s.erreurNom,
      onChanged: (String _) {
        if (_s.erreurNom != null) _change(() => _s.erreurNom = null);
      },
    ),
    ?widget.rappel,
    CpiField(
      key: const ValueKey<String>('visite-venu-de'),
      label: 'Venu de',
      hint: 'Ex. BICIS',
      description: 'L\'employeur du visiteur, s\'il en cite un.',
      controller: _s.venuDe,
      textCapitalization: TextCapitalization.sentences,
      textInputAction: TextInputAction.next,
    ),
    // Le Sénégal par défaut, sans y être enfermé : un visiteur étranger dicte
    // son numéro tel quel, et c'est tel quel qu'il est écrit au registre — le
    // serveur ne le renormalise pas non plus.
    PhoneField(
      key: const ValueKey<String>('visite-telephone'),
      controller: _s.telephone,
      strictSenegal: false,
      helper: 'Sénégal par défaut. Pour un autre pays, commencez par +.',
      onChanged: (String _) => widget.onModifie(),
    ),
  ];

  List<Widget> _note() => <Widget>[
    CpiField(
      key: const ValueKey<String>('visite-note'),
      label: 'Note',
      hint: 'Ex. reçu par Mme Ndoye',
      controller: _s.note,
      maxLines: 4,
      textInputAction: TextInputAction.done,
      textCapitalization: TextCapitalization.sentences,
    ),
  ];

  List<Widget> _pourQui() {
    final VisiteReferentielsBundleDto bundle = widget.bundle;
    final TopLabels frequents = widget.frequents;
    return <Widget>[
      _liste(
        cle: 'champ-entreprise',
        label: 'Société visitée',
        hint: 'Ex. CPI',
        description: 'CPI, Santargile ou Make-up Addiction.',
        noMatchHint:
            'Cette liste ne contient que les sociétés du groupe. '
            'Écrivez « BICIS » dans « Venu de ».',
        controller: _s.entreprise,
        focusNode: _s.entrepriseFocus,
        options: optionsVisite(bundle.entreprises, frequents.entreprises),
        selectedId: _s.entrepriseId,
        error: _s.erreurEntreprise,
        onId: (String? id) {
          _s.entrepriseId = id;
          if (id != null) _s.erreurEntreprise = null;
        },
      ),
      _liste(
        cle: 'champ-destinataire',
        label: 'Vient voir',
        hint: 'Ex. Mme Ndoye',
        description: 'Laissez vide si le visiteur ne sait pas.',
        controller: _s.destinataire,
        focusNode: _s.destinataireFocus,
        options: optionsVisite(
          bundle.destinataires,
          frequents.destinataires,
          roleEnSousTitre: true,
          sousTitreAutre: 'quelqu\'un qui n\'est pas dans la liste',
        ),
        selectedId: _s.destinataireId,
        onId: (String? id) => _s.destinataireId = id,
      ),
      _liste(
        cle: 'champ-direction',
        label: 'Étage ou service',
        hint: 'Ex. 2ème étage CPI',
        controller: _s.direction,
        focusNode: _s.directionFocus,
        options: optionsVisite(bundle.directions, const <LabelCompte>[]),
        selectedId: _s.directionId,
        onId: (String? id) => _s.directionId = id,
      ),
      _liste(
        cle: 'champ-objet',
        label: 'Objet de la visite',
        hint: 'Ex. Suivi de dossier',
        controller: _s.objet,
        focusNode: _s.objetFocus,
        options: optionsVisite(bundle.objets, frequents.objets),
        selectedId: _s.objetId,
        error: _s.erreurObjet,
        onId: (String? id) {
          _s.objetId = id;
          if (id != null) _s.erreurObjet = null;
        },
      ),
    ];
  }
}
