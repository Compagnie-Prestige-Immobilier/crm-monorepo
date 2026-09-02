import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/drafts/draft_form_mixin.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/providers/connectivity.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/ids.dart';
import '../../../core/utils/phone.dart';
import '../../../data/local/database.dart';
import '../../../data/repositories/draft_repository.dart';
import '../../../data/repositories/write_repository.dart';
import '../../../ui/widgets/cpi_choice_group.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/cpi_steps.dart';
import '../../../ui/widgets/local_typeahead.dart';
import '../../../ui/widgets/cpi_resume_banner.dart';
import '../../../ui/widgets/phone_field.dart';
import '../../../ui/widgets/referentials_banner.dart';
import '../situation_labels.dart';

class ProspectEntryScreen extends ConsumerStatefulWidget {
  const ProspectEntryScreen({
    super.key,
    this.representantId,
    this.draftId,
    this.projet = 'CHUES',
  });

  final String? representantId;
  final String? draftId;
  final String projet;

  @override
  ConsumerState<ProspectEntryScreen> createState() =>
      _ProspectEntryScreenState();
}

class _ProspectEntryScreenState extends ConsumerState<ProspectEntryScreen>
    with DraftFormMixin<ProspectEntryScreen> {
  final TextEditingController _nom = TextEditingController();
  final TextEditingController _prenom = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _banque = TextEditingController();
  final TextEditingController _syndicat = TextEditingController();
  final TextEditingController _profession = TextEditingController();
  final TextEditingController _anciennete = TextEditingController();
  final TextEditingController _canal = TextEditingController();
  final TextEditingController _tranche = TextEditingController();
  final TextEditingController _employeur = TextEditingController();
  final TextEditingController _lieuActivite = TextEditingController();
  final TextEditingController _paysResidence = TextEditingController();
  final TextEditingController _villeResidence = TextEditingController();
  final TextEditingController _whatsapp = TextEditingController();
  final TextEditingController _relaisNom = TextEditingController();
  final TextEditingController _relaisPhone = TextEditingController();

  late final Map<TextEditingController, FocusNode> _focus =
      <TextEditingController, FocusNode>{
        for (final TextEditingController c in _controllers) c: FocusNode(),
      };

  List<TextEditingController> get _controllers => <TextEditingController>[
    _nom,
    _prenom,
    _phone,
    _banque,
    _syndicat,
    _profession,
    _anciennete,
    _canal,
    _tranche,
    _employeur,
    _lieuActivite,
    _paysResidence,
    _villeResidence,
    _whatsapp,
    _relaisNom,
    _relaisPhone,
  ];

  FocusNode _noeud(TextEditingController controller) => _focus[controller]!;

  late String _draftId = widget.draftId ?? Ids.newId();

  String? _representantId;
  String? _banqueId;
  String? _syndicatId;
  String? _type;
  String? _canalId;
  String? _incomeBandId;
  String? _employeurId;
  String? _typeContrat;
  String? _modeEpargne;
  String? _paysResidenceId;

  /// L'indicatif du pays de résidence, sans le « + ». Le Sénégal par défaut :
  /// le champ international sert d'abord à ceux qui n'ont pas encore dit d'où
  /// ils appellent.
  String _indicatif = kSenegalCallingCode;

  /// Les trois référentiels lus par `build`, relus par les champs de l'étape.
  List<Employeur> _employeurs = const <Employeur>[];
  List<PaysRow> _pays = const <PaysRow>[];
  List<IncomeBand> _tranches = const <IncomeBand>[];

  Representant? _representant;

  bool _saving = false;

  /// Le représentant s'inscrit lui-même : sa fiche pré-remplit le formulaire,
  /// et l'enregistrement reste celui de n'importe quel prospect chez lui.
  bool _luiMeme = false;

  String? _error;
  String? _duplicateName;
  Timer? _lookupDebounce;
  DraftSnapshot? _pendingRestore;

  /// L'étape en cours, à partir de 1. Deux pour le CHUES — qui est-ce, puis sa
  /// banque et son syndicat —, trois pour le Grand Public, qui intercale son
  /// travail.
  int _step = 1;

  /// Ce que « Réessayer » relance après un échec d'enregistrement.
  bool _lastAndNext = true;

  @override
  String get draftId => _draftId;

  @override
  String get draftFormKey => widget.projet == 'CHUES'
      ? 'prospect.create'
      : 'prospect.create.${widget.projet}';

  @override
  String? get draftParentId => _representantId;

  @override
  DraftRepository get draftRepository => ref.read(draftRepositoryProvider);

  @override
  bool get draftIsEmpty =>
      _controllers.every((TextEditingController c) => c.text.trim().isEmpty) &&
      _banqueId == null &&
      _syndicatId == null &&
      _type == null &&
      _canalId == null &&
      _incomeBandId == null &&
      _employeurId == null &&
      _typeContrat == null &&
      _modeEpargne == null &&
      _paysResidenceId == null;

  @override
  String? draftRouteWithId() {
    if (widget.draftId != null) return null;
    if (widget.projet == 'GRAND_PUBLIC') {
      return Routes.grandPublicNewWithDraft(_draftId);
    }
    final String? representantId = widget.representantId;
    return representantId == null
        ? null
        : Routes.newProspectFor(representantId, draftId: _draftId);
  }

  @override
  Map<String, Object?> collectDraftValues() => <String, Object?>{
    'nom': _nom.text,
    'prenom': _prenom.text,
    'phone': _phone.text,
    'banqueId': _banqueId,
    'banqueLabel': _banque.text,
    'syndicatId': _syndicatId,
    'syndicatLabel': _syndicat.text,
    'representantId': _representantId,
    'type': _type,
    'profession': _profession.text,
    'anciennete': _anciennete.text,
    'canalId': _canalId,
    'canalLabel': _canal.text,
    'incomeBandId': _incomeBandId,
    'incomeBandLabel': _tranche.text,
    'employeurId': _employeurId,
    'employeurLabel': _employeur.text,
    'typeContrat': _typeContrat,
    'lieuActivite': _lieuActivite.text,
    'modeEpargne': _modeEpargne,
    'paysResidenceId': _paysResidenceId,
    'paysResidenceLabel': _paysResidence.text,
    'indicatif': _indicatif,
    'villeResidence': _villeResidence.text,
    'whatsapp': _whatsapp.text,
    'relaisNom': _relaisNom.text,
    'relaisPhone': _relaisPhone.text,
  };

  @override
  void initState() {
    super.initState();
    _representantId = widget.representantId;
    for (final FocusNode node in _focus.values) {
      node.addListener(() {
        if (!node.hasFocus) unawaited(flushDraft());
      });
    }
    unawaited(_restore());
  }

  @override
  void dispose() {
    _lookupDebounce?.cancel();
    for (final TextEditingController c in _controllers) {
      c.dispose();
    }
    for (final FocusNode n in _focus.values) {
      n.dispose();
    }
    super.dispose();
  }

  Future<void> _restore() async {
    final DraftRepository drafts = ref.read(draftRepositoryProvider);
    DraftSnapshot? snapshot = await drafts.read(_draftId);
    if (snapshot == null && widget.draftId == null) {
      final DraftSnapshot? latest = await drafts.latestFor(draftFormKey);
      if (latest != null && _acceptsParent(latest)) snapshot = latest;
    }
    if (snapshot != null && mounted) _offer(snapshot);
    await _loadRepresentant();
  }

  bool _acceptsParent(DraftSnapshot snapshot) {
    final String? mine = widget.representantId;
    if (mine == null) return true;
    final Object? theirs =
        snapshot.parentId ?? snapshot.values['representantId'];
    return theirs == null || theirs == mine;
  }

  void _offer(DraftSnapshot snapshot) {
    switch (snapshot.age) {
      case DraftAge.crash:
        _apply(snapshot);
      case DraftAge.resumable:
        setState(() => _pendingRestore = snapshot);
      case DraftAge.stale:
        break;
    }
  }

  void _apply(DraftSnapshot snapshot) {
    final bool adopted = snapshot.draftId != _draftId;
    setState(() {
      if (adopted) _draftId = snapshot.draftId;
      _nom.text = (snapshot.values['nom'] as String?) ?? '';
      _prenom.text = (snapshot.values['prenom'] as String?) ?? '';
      _phone.text = (snapshot.values['phone'] as String?) ?? '';
      _banqueId = snapshot.values['banqueId'] as String?;
      _banque.text = (snapshot.values['banqueLabel'] as String?) ?? '';
      _syndicatId = snapshot.values['syndicatId'] as String?;
      _syndicat.text = (snapshot.values['syndicatLabel'] as String?) ?? '';
      _representantId =
          _representantId ?? snapshot.values['representantId'] as String?;
      _type = snapshot.values['type'] as String?;
      _profession.text = (snapshot.values['profession'] as String?) ?? '';
      _anciennete.text = (snapshot.values['anciennete'] as String?) ?? '';
      _canalId = snapshot.values['canalId'] as String?;
      _canal.text = (snapshot.values['canalLabel'] as String?) ?? '';
      _incomeBandId = snapshot.values['incomeBandId'] as String?;
      _tranche.text = (snapshot.values['incomeBandLabel'] as String?) ?? '';
      _employeurId = snapshot.values['employeurId'] as String?;
      _employeur.text = (snapshot.values['employeurLabel'] as String?) ?? '';
      _typeContrat = snapshot.values['typeContrat'] as String?;
      _lieuActivite.text = (snapshot.values['lieuActivite'] as String?) ?? '';
      _modeEpargne = snapshot.values['modeEpargne'] as String?;
      _paysResidenceId = snapshot.values['paysResidenceId'] as String?;
      _paysResidence.text =
          (snapshot.values['paysResidenceLabel'] as String?) ?? '';
      _indicatif =
          (snapshot.values['indicatif'] as String?) ?? kSenegalCallingCode;
      _villeResidence.text =
          (snapshot.values['villeResidence'] as String?) ?? '';
      _whatsapp.text = (snapshot.values['whatsapp'] as String?) ?? '';
      _relaisNom.text = (snapshot.values['relaisNom'] as String?) ?? '';
      _relaisPhone.text = (snapshot.values['relaisPhone'] as String?) ?? '';
      _pendingRestore = null;
    });
    if (adopted) republishDraftRoute();
    unawaited(_loadRepresentant());
  }

  Future<void> _loadRepresentant() async {
    final String? id = _representantId;
    if (id == null) return;
    final Representant? rep = await ref
        .read(referenceRepositoryProvider)
        .representantById(id);
    if (mounted) setState(() => _representant = rep);
  }

  /// Le numéro tel qu'il sera stocké. La diaspora dicte un numéro d'un autre
  /// pays : le plan sénégalais ne lui applique ni sa longueur ni son découpage.
  String? get _phoneE164 => _diaspora
      ? WorldPhone.toE164(_phone.text, callingCode: _indicatif)
      : Phone.toE164(_phone.text);

  void _scheduleLookup() {
    _lookupDebounce?.cancel();
    _lookupDebounce = Timer(const Duration(milliseconds: 300), () async {
      final String? e164 = _phoneE164;
      if (e164 == null) {
        if (mounted) setState(() => _duplicateName = null);
        return;
      }
      final Prospect? match = await ref
          .read(referenceRepositoryProvider)
          .findProspectByPhone(e164);
      if (mounted) {
        setState(
          () => _duplicateName = match == null
              ? null
              : '${match.prenom} ${match.nom}'.trim(),
        );
      }
    });
  }

  /// Pré-remplissage seulement : le représentant devient un prospect comme un
  /// autre, avec la même validation et le même enregistrement.
  void _basculerLuiMeme(bool actif) {
    final Representant? rep = _representant;
    if (rep == null) return;
    final List<String> mots = rep.fullName.trim().split(RegExp(r'\s+'));
    setState(() {
      _luiMeme = actif;
      _prenom.text = actif && mots.length > 1 ? mots.first : '';
      _nom.text = actif
          ? (mots.length > 1 ? mots.skip(1).join(' ') : rep.fullName.trim())
          : '';
      _phone.text = actif
          ? Phone.groupNational(Phone.digitsOf(rep.phoneE164))
          : '';
      _duplicateName = null;
    });
    markDraftDirty();
    _scheduleLookup();
  }

  /// Le nom, le numéro, et pour le Grand Public la situation : rien d'autre. Un
  /// champ de plus rendu obligatoire et la saisie est abandonnée sur le terrain.
  bool get _canSave =>
      _nom.text.trim().isNotEmpty &&
      _phoneE164 != null &&
      (widget.projet != 'GRAND_PUBLIC' || _type != null) &&
      !_saving;

  bool get _grandPublic => widget.projet == 'GRAND_PUBLIC';

  bool get _salarie => _type == 'FONCTIONNAIRE' || _type == 'SECTEUR_PRIVE';

  bool get _diaspora => _grandPublic && _type == 'DIASPORA';

  /// L'informel n'a pas de compte à domicilier ; les trois autres situations,
  /// si, la diaspora au Sénégal.
  bool get _avecBanque => !_grandPublic || _type != 'INFORMEL';

  int get _lastStep => _grandPublic ? 3 : 2;

  /// La question de l'étape, celle qui tient lieu de titre.
  String get _question => switch (_step) {
    1 => 'Qui est-ce ?',
    2 when _grandPublic => switch (_type) {
      'DIASPORA' => 'Où vit-il ?',
      'INFORMEL' => 'Que fait-il ?',
      _ => 'Où travaille-t-il ?',
    },
    _ when _grandPublic =>
      _avecBanque ? 'Sa banque, sa provenance' : 'Comment l’a-t-il connu ?',
    _ => 'Sa banque, son syndicat',
  };

  /// Ce qui retient l'étape, nommé sous « Continuer ». Tout ce qui est
  /// obligatoire se demande à la première étape ; les suivantes sont libres.
  String? get _manque {
    if (_step > 1) return null;
    if (_nom.text.trim().isEmpty) return 'Écrivez le nom';
    if (_phoneE164 == null) return 'Écrivez le numéro complet';
    if (_grandPublic && _type == null) return 'Choisissez la situation';
    return null;
  }

  /// Ce qu'une situation ne demande pas ne doit pas voyager avec la fiche : un
  /// ministère saisi, puis la situation corrigée en « Informel », partirait
  /// sinon avec une fiche qui n'a plus rien à en faire.
  void _effacerSituation() {
    for (final TextEditingController c in <TextEditingController>[
      _profession,
      _anciennete,
      _employeur,
      _lieuActivite,
      _paysResidence,
      _villeResidence,
      _whatsapp,
      _relaisNom,
      _relaisPhone,
    ]) {
      c.clear();
    }
    _employeurId = null;
    _typeContrat = null;
    _modeEpargne = null;
    _paysResidenceId = null;
    _indicatif = kSenegalCallingCode;
    // La banque et le syndicat servent aussi au CHUES, qui n'a pas de
    // situation : là ils se gardent d'une fiche à l'autre.
    if (!_grandPublic) return;
    if (!_avecBanque) {
      _banqueId = null;
      _banque.clear();
    }
    if (_type != 'FONCTIONNAIRE') {
      _syndicatId = null;
      _syndicat.clear();
    }
  }

  void _precedent() {
    FocusScope.of(context).unfocus();
    setState(() => _step -= 1);
  }

  void _suivant() {
    FocusScope.of(context).unfocus();
    setState(() => _step += 1);
    unawaited(flushDraft());
  }

  List<CpiRecapLine> get _recap => <CpiRecapLine>[
    CpiRecapLine('Nom complet', '${_prenom.text} ${_nom.text}'.trim()),
    CpiRecapLine('Téléphone', _phone.text),
    if (_grandPublic) CpiRecapLine('Situation', _ChampSituation.libelle(_type)),
    if (_grandPublic && _salarie)
      CpiRecapLine(
        _type == 'FONCTIONNAIRE' ? 'Ministère ou structure' : 'Employeur',
        _employeur.text,
      ),
    if (_grandPublic && _type == 'INFORMEL')
      CpiRecapLine('Activité', _profession.text),
    if (_diaspora) CpiRecapLine('Pays de résidence', _paysResidence.text),
    if (_avecBanque) CpiRecapLine('Banque', _banque.text),
    if (!_grandPublic || _type == 'FONCTIONNAIRE')
      CpiRecapLine('Syndicat', _syndicat.text),
  ];

  Future<void> _save({required bool andNext}) async {
    if (!_canSave) return;
    setState(() {
      _saving = true;
      _lastAndNext = andNext;
      _error = null;
    });
    // Capturés avant les `await` : la fiche peut être enregistrée juste après un
    // retour arrière, et l'envoi ne doit pas dépendre d'un `ref` démonté.
    final SyncCoordinator sync = ref.read(syncCoordinatorProvider.notifier);
    final WriteRepository writes = ref.read(writeRepositoryProvider);
    try {
      final String? userId = await ref.read(tokenStoreProvider).readUserId();
      if (userId == null) {
        if (!mounted) return;
        setState(() {
          _saving = false;
          _error = 'Session introuvable. Reconnectez-vous.';
        });
        return;
      }
      // Le brouillon se jette AVANT l'écriture : sinon le minuteur armé par la
      // dernière frappe se déclenche pendant la transaction et réécrit la ligne
      // qu'elle vient de supprimer.
      discardDraft();
      await writes.createProspect(
        nom: _nom.text.trim(),
        prenom: _prenom.text.trim(),
        phoneE164: _phoneE164!,
        banqueId: _avecBanque ? _banqueId : null,
        syndicatId: !_grandPublic || _type == 'FONCTIONNAIRE'
            ? _syndicatId
            : null,
        representantId: _representantId,
        projet: widget.projet,
        type: _type,
        // Seul l'informel et la diaspora déclarent un métier : ailleurs c'est
        // l'employeur qui porte le renseignement.
        profession: _grandPublic && _salarie ? null : _profession.text.trim(),
        canalProvenanceId: _canalId,
        incomeBandId: _grandPublic ? _incomeBandId : null,
        employeurId: _salarie ? _employeurId : null,
        // Le repli en clair n'a de sens que sans identifiant : sinon le serveur
        // recevrait deux fois le même employeur, dont une copie qui vieillira.
        employeur: _salarie && _employeurId == null
            ? _employeur.text.trim()
            : null,
        typeContrat: _type == 'SECTEUR_PRIVE' ? _typeContrat : null,
        ancienneteMois: _salarie ? int.tryParse(_anciennete.text.trim()) : null,
        lieuActivite: _type == 'INFORMEL' ? _lieuActivite.text.trim() : null,
        modeEpargne: _type == 'INFORMEL' ? _modeEpargne : null,
        paysResidenceId: _diaspora ? _paysResidenceId : null,
        villeResidence: _diaspora ? _villeResidence.text.trim() : null,
        whatsappE164: _diaspora
            ? WorldPhone.toE164(_whatsapp.text, callingCode: _indicatif)
            : null,
        relaisNom: _diaspora ? _relaisNom.text.trim() : null,
        relaisPhoneE164: _diaspora ? Phone.toE164(_relaisPhone.text) : null,
        createdById: userId,
        draftId: _draftId,
      );

      await HapticFeedback.mediumImpact();
      sync.nudge();

      if (!mounted) return;
      if (andNext) {
        setState(() {
          _nom.clear();
          _prenom.clear();
          _phone.clear();
          _effacerSituation();
          // La situation repart à vide : la garder ferait enregistrer la fiche
          // suivante sous celui de la précédente sans que personne le relise.
          _type = null;
          _duplicateName = null;
          _luiMeme = false;
          _saving = false;
          _step = 1;
        });
        _noeud(_nom).requestFocus();
      } else {
        // Éteint AVANT de quitter : au retour arrière l'écran retrouvé gardait
        // sa roue de progression et ses deux boutons éteints.
        setState(() => _saving = false);
        popOrHome(
          context,
          fallback: widget.projet == 'GRAND_PUBLIC'
              ? Routes.grandPublic
              : Routes.historique,
        );
      }
    } on Object catch (e) {
      if (!mounted) return;
      final String message = _humanize(e);
      setState(() {
        _saving = false;
        _error = message;
      });
      _announceFailure(message);
    }
  }

  static String _humanize(Object error) {
    final String raw = error.toString();
    if (raw.contains('prospects.phone_e164') ||
        raw.contains('prospects_phone_unique')) {
      return 'Ce numéro est déjà enregistré sur cet appareil.';
    }
    return 'Enregistrement impossible. $raw';
  }

  /// Le message est déjà posé sous les boutons, dans une région vive : seule
  /// l'annonce assertive manque au lecteur d'écran qui a le doigt ailleurs.
  void _announceFailure(String message) {
    unawaited(
      SemanticsService.sendAnnouncement(
        View.of(context),
        message,
        Directionality.of(context),
        assertiveness: Assertiveness.assertive,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final AsyncValue<List<Banque>> banquesLues = ref.watch(banquesProvider);
    final AsyncValue<List<Syndicat>> syndicatsLus = ref.watch(
      syndicatsProvider,
    );
    final List<Banque> banques = banquesLues.value ?? const <Banque>[];
    final List<Syndicat> syndicats = syndicatsLus.value ?? const <Syndicat>[];
    // Tant que la base n'a pas répondu, les listes sont vides sans être
    // absentes : accuser le téléchargement fait clignoter l'avertissement.
    final bool referentielsManquants =
        banquesLues.hasValue &&
        syndicatsLus.hasValue &&
        (banques.isEmpty || syndicats.isEmpty);
    final List<CanauxProvenanceData> canaux =
        ref.watch(canauxProvenanceProvider).value ??
        const <CanauxProvenanceData>[];
    // Lues ici et non dans le champ qui les affiche : un flux ouvert seulement
    // à l'étape 2 sert sa première valeur APRÈS la première image du champ, et
    // la liste s'ouvre vide sur la frappe qui la suit.
    _employeurs = ref.watch(employeursProvider).value ?? const <Employeur>[];
    _pays = ref.watch(paysProvider).value ?? const <PaysRow>[];
    _tranches = ref.watch(incomeBandsProvider).value ?? const <IncomeBand>[];
    final int count = _representantId == null
        ? 0
        : (ref.watch(prospectCountForProvider(_representantId!)).value ?? 0);
    final bool grandPublic = _grandPublic;
    final String fallback = grandPublic
        ? Routes.grandPublic
        : Routes.historique;

    final String contexte = _representant == null
        ? grandPublic
              ? 'Grand public'
              : 'Sans représentant'
        : '${_representant!.fullName} · '
              '$count prospect${count > 1 ? 's' : ''} ajouté'
              '${count > 1 ? 's' : ''}';
    final bool premiere = _step == 1;
    final bool derniere = _step == _lastStep;

    final Widget screen = CpiScaffold(
      title: _question,
      showTitle: false,
      leading: premiere
          ? CpiBackButton(fallback: fallback)
          : CpiHeaderAction(
              icon: PhosphorIconsRegular.arrowLeft,
              label: 'Étape précédente',
              onPressed: _saving ? null : _precedent,
            ),
      banner: _band(),
      footer: _Footer(
        canSave: _canSave,
        saving: _saving,
        continuer: !derniere,
        manque: _manque,
        onContinue: _suivant,
        onNext: () => _save(andNext: true),
        onDone: () => _save(andNext: false),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          // Hors du défilement : la question de l'étape et son rang restent
          // lisibles pendant qu'on remplit les champs.
          CpiStepHeader(step: _step, total: _lastStep, question: _question),
          Expanded(
            child: CustomScrollView(
              slivers: <Widget>[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      CpiSpacing.md,
                      0,
                      CpiSpacing.md,
                      CpiSpacing.sm,
                    ),
                    child: Text(
                      contexte,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ),
                // Le bandeau des listes manquantes accompagne l'étape où l'on
                // choisit dans ces listes, pas l'écran d'ouverture.
                if (!grandPublic && derniere)
                  SliverToBoxAdapter(
                    child: ReferentialsBanner(missing: referentielsManquants),
                  ),
                if (!grandPublic && premiere && _representant != null)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(
                        CpiSpacing.md,
                        0,
                        CpiSpacing.md,
                        CpiSpacing.sm,
                      ),
                      child: CpiCard.rows(<CpiRow>[
                        CpiRow(
                          title: 'Le représentant lui-même est intéressé',
                          subtitle: 'Son nom et son numéro sont déjà remplis.',
                          trailing: FSwitch(
                            value: _luiMeme,
                            onChange: _saving ? null : _basculerLuiMeme,
                          ),
                          onTap: _saving
                              ? null
                              : () => _basculerLuiMeme(!_luiMeme),
                        ),
                      ]),
                    ),
                  ),
                if (_pendingRestore != null)
                  SliverToBoxAdapter(
                    child: CpiResumeBanner(
                      onResume: () => _apply(_pendingRestore!),
                      onDiscard: () async {
                        await ref
                            .read(draftRepositoryProvider)
                            .delete(_pendingRestore!.draftId);
                        if (mounted) setState(() => _pendingRestore = null);
                      },
                    ),
                  ),
                SliverPadding(
                  padding: const EdgeInsets.all(CpiSpacing.md),
                  sliver: SliverList.list(
                    children: <Widget>[
                      ..._champsDeLEtape(
                        theme,
                        cpi,
                        banques,
                        syndicats,
                        canaux,
                      ),
                      if (derniere) ...<Widget>[
                        const SizedBox(height: CpiSpacing.md),
                        CpiRecap(lines: _recap),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    return CpiStepScope(
      first: premiere,
      fallback: fallback,
      // Rien pendant l'enregistrement : reculer changerait la fiche que
      // l'écriture est en train de poser.
      onBack: _saving ? null : _precedent,
      child: screen,
    );
  }

  List<Widget> _champsDeLEtape(
    ThemeData theme,
    CpiColors cpi,
    List<Banque> banques,
    List<Syndicat> syndicats,
    List<CanauxProvenanceData> canaux,
  ) => switch (_step) {
    1 => _champsQui(theme, cpi),
    2 when _grandPublic => _champsTravail(),
    _ => _champsBanque(banques, syndicats, canaux),
  };

  /// Un séparateur entre deux champs, systématiquement : le pas vertical du kit
  /// ne se devine pas d'un formulaire à l'autre.
  static List<Widget> _espaces(List<Widget> champs) => <Widget>[
    for (int i = 0; i < champs.length; i++) ...<Widget>[
      if (i > 0) const SizedBox(height: CpiSpacing.md),
      champs[i],
    ],
  ];

  /// Une seule bande d'état, sous le titre : l'échec d'abord, le réseau sinon.
  Widget? _band() {
    final String? error = _error;
    if (error != null) {
      return CpiStatusBand(
        text: error,
        tone: CpiTone.danger,
        actionLabel: 'Réessayer',
        onAction: () => _save(andNext: _lastAndNext),
      );
    }
    if (ref.watch(connectivityProvider) == CpiConnectivity.online) return null;
    return const CpiStatusBand(
      text: 'Hors ligne. La fiche est gardée.',
      tone: CpiTone.warning,
    );
  }

  List<Widget> _champsQui(ThemeData theme, CpiColors cpi) {
    return <Widget>[
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(
            child: CpiField(
              label: 'Prénom',
              controller: _prenom,
              focusNode: _noeud(_prenom),
              hint: 'Ex. Fatou',
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              onChanged: (String _) {
                markDraftDirty();
                setState(() {});
              },
            ),
          ),
          const SizedBox(width: CpiSpacing.sm),
          Expanded(
            child: CpiField(
              label: 'Nom',
              controller: _nom,
              focusNode: _noeud(_nom),
              hint: 'Ex. Sarr',
              autofocus: true,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              onChanged: (String _) {
                markDraftDirty();
                setState(() {});
              },
            ),
          ),
        ],
      ),
      const SizedBox(height: CpiSpacing.md),
      if (_diaspora)
        InternationalPhoneField(
          controller: _phone,
          focusNode: _noeud(_phone),
          callingCode: _indicatif,
          helper: 'Le numéro du pays où il vit.',
          onChanged: (String _) {
            markDraftDirty();
            _scheduleLookup();
            setState(() {});
          },
        )
      else
        PhoneField(
          controller: _phone,
          focusNode: _noeud(_phone),
          // Le numéro du représentant vient de sa fiche : le retoucher ici
          // créerait un prospect que rien ne relie plus à personne.
          enabled: !_luiMeme,
          onChanged: (String _) {
            markDraftDirty();
            _scheduleLookup();
            setState(() {});
          },
        ),
      if (_duplicateName != null) ...<Widget>[
        const SizedBox(height: CpiSpacing.xs),
        Row(
          children: <Widget>[
            Icon(
              PhosphorIconsRegular.warningCircle,
              size: CpiIconSize.xs,
              color: cpi.accentText,
            ),
            const SizedBox(width: CpiSpacing.xxs),
            Expanded(
              child: Text(
                'Déjà saisi : $_duplicateName',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: cpi.accentText,
                ),
              ),
            ),
          ],
        ),
      ],
      if (_grandPublic) ...<Widget>[
        const SizedBox(height: CpiSpacing.md),
        _ChampSituation(
          valeur: _type,
          onChanged: (String valeur) {
            setState(() {
              _type = valeur;
              _effacerSituation();
            });
            markDraftDirty();
            unawaited(flushDraft());
          },
        ),
      ],
    ];
  }

  /// Grand Public : ce que la situation choisie demande, et rien d'autre.
  List<Widget> _champsTravail() => _espaces(switch (_type) {
    'FONCTIONNAIRE' => <Widget>[
      _champEmployeur('MINISTERE', 'Ministère ou structure', 'Ex. Éducation'),
      _champAnciennete(),
    ],
    'SECTEUR_PRIVE' => <Widget>[
      _champEmployeur('ENTREPRISE', 'Employeur', 'Ex. Sonatel'),
      _champTypeContrat(),
      _champAnciennete(),
    ],
    'INFORMEL' => <Widget>[
      _champTexte(_profession, 'Activité', 'Ex. Couture'),
      _champTexte(_lieuActivite, 'Lieu d\'activité', 'Ex. Marché Sandaga'),
      _champModeEpargne(),
    ],
    'DIASPORA' => <Widget>[
      _champPays(),
      _champTexte(_villeResidence, 'Ville', 'Ex. Milan'),
      _champTexte(_profession, 'Profession là-bas', 'Ex. Chauffeur'),
      InternationalPhoneField(
        controller: _whatsapp,
        focusNode: _noeud(_whatsapp),
        callingCode: _indicatif,
        label: 'Numéro WhatsApp',
        helper: 'S\'il est différent du numéro principal.',
        onChanged: (String _) => markDraftDirty(),
      ),
      _champTexte(_relaisNom, 'Personne relais au Sénégal', 'Ex. Awa Sarr'),
      PhoneField(
        controller: _relaisPhone,
        focusNode: _noeud(_relaisPhone),
        label: 'Téléphone du relais',
        textInputAction: TextInputAction.done,
        onChanged: (String _) => markDraftDirty(),
      ),
    ],
    _ => const <Widget>[],
  });

  Widget _champTexte(
    TextEditingController controller,
    String label,
    String hint,
  ) => CpiField(
    label: label,
    controller: controller,
    focusNode: _noeud(controller),
    hint: hint,
    textCapitalization: TextCapitalization.sentences,
    textInputAction: TextInputAction.next,
    onChanged: (String _) => markDraftDirty(),
  );

  Widget _champAnciennete() => CpiField(
    label: 'Ancienneté',
    controller: _anciennete,
    focusNode: _noeud(_anciennete),
    hint: 'Ex. 24',
    keyboardType: TextInputType.number,
    textInputAction: TextInputAction.next,
    suffix: const Text('mois'),
    description: 'En mois',
    onChanged: (String _) => markDraftDirty(),
  );

  /// Le référentiel ASSISTE la saisie sans la borner : un employeur absent de
  /// la liste s'écrit en clair et part tel quel.
  Widget _champEmployeur(String type, String label, String hint) {
    return LocalTypeahead(
      controller: _employeur,
      focusNode: _noeud(_employeur),
      label: label,
      hint: hint,
      freeText: true,
      maxLength: 160,
      selectedId: _employeurId,
      emptyHint: 'La liste n\'est pas encore arrivée.',
      options: _employeurs
          .where((Employeur e) => e.type == type)
          .map(
            (Employeur e) => TypeaheadOption(
              id: e.id,
              label: e.label,
              keywords: <String>[e.code],
            ),
          )
          .toList(growable: false),
      onChanged: (String _) {
        if (_employeurId != null) setState(() => _employeurId = null);
        markDraftDirty();
      },
      onSelected: (TypeaheadOption o) {
        setState(() => _employeurId = o.id);
        markDraftDirty();
        unawaited(flushDraft());
      },
    );
  }

  Widget _champPays() {
    return LocalTypeahead(
      controller: _paysResidence,
      focusNode: _noeud(_paysResidence),
      label: 'Pays de résidence',
      hint: 'Ex. Italie',
      description: 'Il donne l\'indicatif du téléphone.',
      selectedId: _paysResidenceId,
      emptyHint: 'La liste n\'est pas encore arrivée.',
      options: _pays
          .map(
            (PaysRow p) => TypeaheadOption(
              id: p.id,
              label: p.label,
              secondary: '+${p.indicatif}',
              keywords: <String>[p.code, p.indicatif],
            ),
          )
          .toList(growable: false),
      onChanged: (String _) {
        if (_paysResidenceId != null) setState(() => _paysResidenceId = null);
        markDraftDirty();
      },
      onSelected: (TypeaheadOption o) {
        setState(() {
          _paysResidenceId = o.id;
          _indicatif = _pays.firstWhere((PaysRow p) => p.id == o.id).indicatif;
        });
        markDraftDirty();
        unawaited(flushDraft());
      },
    );
  }

  Widget _champTypeContrat() => _choix(
    label: 'Type de contrat',
    value: _typeContrat,
    libelles: kTypeContratLabels,
    onChanged: (String choisi) => _typeContrat = choisi,
  );

  Widget _champModeEpargne() => _choix(
    label: 'Mode d\'épargne',
    value: _modeEpargne,
    libelles: kModeEpargneLabels,
    onChanged: (String choisi) => _modeEpargne = choisi,
  );

  Widget _choix({
    required String label,
    required String? value,
    required Map<String, String> libelles,
    required ValueChanged<String> onChanged,
  }) => CpiChoiceGroup<String>(
    label: label,
    value: value,
    options: <CpiChoice<String>>[
      for (final MapEntry<String, String> e in libelles.entries)
        CpiChoice<String>(value: e.key, label: e.value),
    ],
    onChanged: (String choisi) {
      setState(() => onChanged(choisi));
      markDraftDirty();
      unawaited(flushDraft());
    },
  );

  List<Widget> _champsBanque(
    List<Banque> banques,
    List<Syndicat> syndicats,
    List<CanauxProvenanceData> canaux,
  ) => _espaces(<Widget>[
    if (_avecBanque) _champBanque(banques),
    if (!_grandPublic || _type == 'FONCTIONNAIRE') _champSyndicat(syndicats),
    if (_grandPublic) ...<Widget>[
      _champTranche(),
      LocalTypeahead(
        controller: _canal,
        focusNode: _noeud(_canal),
        label: 'Provenance',
        hint: 'Ex. Parrainage',
        description: 'Comment il nous a connus',
        selectedId: _canalId,
        textInputAction: TextInputAction.done,
        emptyHint: canaux.isEmpty
            ? 'La liste n\'est pas encore arrivée.'
            : 'Aucun résultat',
        options: canaux
            .map(
              (CanauxProvenanceData c) => TypeaheadOption(
                id: c.id,
                label: c.label,
                keywords: <String>[c.code],
              ),
            )
            .toList(growable: false),
        onChanged: (String _) {
          if (_canalId != null) setState(() => _canalId = null);
          markDraftDirty();
        },
        onSelected: (TypeaheadOption o) {
          setState(() => _canalId = o.id);
          markDraftDirty();
          unawaited(flushDraft());
        },
      ),
    ],
  ]);

  Widget _champTranche() {
    return LocalTypeahead(
      controller: _tranche,
      focusNode: _noeud(_tranche),
      label: 'Tranche de revenus',
      hint: 'Ex. 100 000 à 200 000',
      selectedId: _incomeBandId,
      emptyHint: 'La liste n\'est pas encore arrivée.',
      options: _tranches
          .map(
            (IncomeBand b) => TypeaheadOption(
              id: b.id,
              label: b.label,
              keywords: <String>[b.code],
            ),
          )
          .toList(growable: false),
      onChanged: (String _) {
        if (_incomeBandId != null) setState(() => _incomeBandId = null);
        markDraftDirty();
      },
      onSelected: (TypeaheadOption o) {
        setState(() => _incomeBandId = o.id);
        markDraftDirty();
        unawaited(flushDraft());
      },
    );
  }

  Widget _champBanque(List<Banque> banques) => LocalTypeahead(
    controller: _banque,
    focusNode: _noeud(_banque),
    label: _grandPublic ? 'Banque de domiciliation' : 'Banque',
    hint: 'Ex. BICIS',
    selectedId: _banqueId,
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
      if (_banqueId != null) setState(() => _banqueId = null);
      markDraftDirty();
    },
    onSelected: (TypeaheadOption o) {
      setState(() => _banqueId = o.id);
      markDraftDirty();
      unawaited(flushDraft());
    },
  );

  Widget _champSyndicat(List<Syndicat> syndicats) => LocalTypeahead(
    controller: _syndicat,
    focusNode: _noeud(_syndicat),
    label: 'Syndicat',
    hint: 'Ex. SAEMSS',
    selectedId: _syndicatId,
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
      if (_syndicatId != null) setState(() => _syndicatId = null);
      markDraftDirty();
    },
    onSelected: (TypeaheadOption o) {
      setState(() => _syndicatId = o.id);
      markDraftDirty();
      unawaited(flushDraft());
    },
  );
}

/// Barre d'action épinglée : continuer, ou les deux issues d'enregistrement.
class _Footer extends StatelessWidget {
  const _Footer({
    required this.canSave,
    required this.saving,
    required this.continuer,
    required this.manque,
    required this.onContinue,
    required this.onNext,
    required this.onDone,
  });

  final bool canSave;
  final bool saving;

  /// Avant la dernière étape : un seul bouton, qui n'enregistre rien.
  final bool continuer;

  /// Ce qui retient l'étape, nommé sous le libellé du bouton éteint.
  final String? manque;

  final VoidCallback onContinue;
  final VoidCallback onNext;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.sm,
        CpiSpacing.md,
        CpiSpacing.sm,
      ),
      child: Column(
        // Le pied de `FScaffold` se mesure sous une contrainte lâche : une
        // colonne « max » y prendrait tout l'écran et laisserait zéro au corps.
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: continuer
            ? <Widget>[
                CpiButton(
                  'Continuer',
                  icon: PhosphorIconsRegular.arrowRight,
                  subtitle: manque,
                  onPressed: manque == null ? onContinue : null,
                ),
              ]
            : <Widget>[
                CpiButton(
                  'Enregistrer et suivant',
                  icon: PhosphorIconsRegular.arrowRight,
                  loading: saving,
                  subtitle: 'Nom et téléphone d\'abord',
                  onPressed: canSave ? onNext : null,
                ),
                const SizedBox(height: CpiSpacing.xs),
                CpiButton(
                  'Enregistrer et terminer',
                  variant: CpiButtonVariant.secondary,
                  onPressed: canSave ? onDone : null,
                ),
              ],
      ),
    ),
  );
}

/// La situation, seule question obligatoire du Grand Public en plus du nom et
/// du numéro : elle décide des renseignements proposés ensuite.
class _ChampSituation extends StatelessWidget {
  const _ChampSituation({required this.valeur, required this.onChanged});

  final String? valeur;
  final ValueChanged<String> onChanged;

  static String? libelle(String? code) =>
      code == null ? null : kSituationLabels[code];

  @override
  Widget build(BuildContext context) => CpiChoiceGroup<String>(
    label: 'Situation',
    value: valeur,
    options: <CpiChoice<String>>[
      for (final MapEntry<String, String> e in kSituationLabels.entries)
        CpiChoice<String>(value: e.key, label: e.value),
    ],
    // Une situation se corrige en touchant un autre choix, pas en le
    // retouchant : le vider laisserait une fiche invalide.
    onChanged: (String choisi) {
      if (choisi != valeur) onChanged(choisi);
    },
  );
}
