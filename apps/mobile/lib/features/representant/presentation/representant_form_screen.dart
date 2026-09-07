import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/drafts/draft_form_mixin.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/sync/api_port.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/ids.dart';
import '../../../core/utils/phone.dart';
import '../../../core/utils/whatsapp.dart';
import '../../../data/local/database.dart';
import '../../../data/repositories/draft_repository.dart';
import '../../../data/repositories/reference_repository.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_choice_group.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/cpi_steps.dart';
import '../../../ui/widgets/local_typeahead.dart';
import '../../../ui/widgets/cpi_resume_banner.dart';
import '../../../ui/widgets/phone_field.dart';
import '../../../ui/widgets/referentials_banner.dart';

class RepresentantFormScreen extends ConsumerStatefulWidget {
  const RepresentantFormScreen({
    super.key,
    this.draftId,
    this.representantId,
    this.prefillName,
    this.prefillPhone,
  });

  final String? draftId;

  final String? representantId;

  final String? prefillName;
  final String? prefillPhone;

  @override
  ConsumerState<RepresentantFormScreen> createState() =>
      _RepresentantFormScreenState();
}

class _RepresentantFormScreenState extends ConsumerState<RepresentantFormScreen>
    with DraftFormMixin<RepresentantFormScreen> {
  static const String formKey = 'representant.create';

  final TextEditingController _nom = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _region = TextEditingController();
  final TextEditingController _departement = TextEditingController();
  final TextEditingController _ief = TextEditingController();
  final TextEditingController _whatsapp = TextEditingController();
  final TextEditingController _profession = TextEditingController();
  final TextEditingController _notes = TextEditingController();
  final FocusNode _nomFocus = FocusNode();
  final FocusNode _phoneFocus = FocusNode();
  final FocusNode _regionFocus = FocusNode();
  final FocusNode _departementFocus = FocusNode();
  final FocusNode _iefFocus = FocusNode();
  final FocusNode _whatsappFocus = FocusNode();
  final FocusNode _professionFocus = FocusNode();
  final FocusNode _notesFocus = FocusNode();

  late String _draftId = widget.draftId ?? Ids.newId();
  late final String _entityId = widget.representantId ?? Ids.newId();

  String? _regionId;
  String? _departementId;
  String? _iefId;
  String _whatsappStatus = WhatsappStatus.nonDemande.code;
  String? _professionId;
  bool _saving = false;
  String? _error;

  Representant? _localMatch;
  RepresentantLookup? _remoteMatch;
  Timer? _lookupDebounce;

  DraftSnapshot? _pendingRestore;

  @override
  String get draftId => _draftId;

  @override
  String get draftFormKey => formKey;

  @override
  String? get draftEntityId => _entityId;

  @override
  DraftRepository get draftRepository => ref.read(draftRepositoryProvider);

  @override
  bool get draftIsEmpty =>
      _nom.text.trim().isEmpty &&
      _phone.text.trim().isEmpty &&
      _notes.text.trim().isEmpty &&
      _profession.text.trim().isEmpty &&
      _whatsappStatus == WhatsappStatus.nonDemande.code &&
      _departementId == null &&
      _iefId == null;

  @override
  String? draftRouteWithId() =>
      widget.draftId == null && widget.representantId == null
      ? Routes.newRepresentantWithDraft(_draftId)
      : null;

  @override
  Map<String, Object?> collectDraftValues() => <String, Object?>{
    'fullName': _nom.text,
    'phone': _phone.text,
    'regionId': _regionId,
    'regionLabel': _region.text,
    'departementId': _departementId,
    'departementLabel': _departement.text,
    'iefId': _iefId,
    'iefLabel': _ief.text,
    'whatsappStatus': _whatsappStatus,
    'whatsapp': _whatsapp.text,
    'profession': _profession.text,
    'notes': _notes.text,
  };

  @override
  void initState() {
    super.initState();
    if (widget.representantId == null) {
      final String? name = widget.prefillName?.trim();
      final String? phone = widget.prefillPhone?.trim();
      if (name != null && name.isNotEmpty) _nom.text = name;
      if (phone != null && phone.isNotEmpty) {
        _phone.text = Phone.groupNational(Phone.digitsOf(phone));
        _scheduleLookup();
      }
    }
    for (final FocusNode node in <FocusNode>[
      _nomFocus,
      _phoneFocus,
      _regionFocus,
      _departementFocus,
      _iefFocus,
      _whatsappFocus,
      _professionFocus,
      _notesFocus,
    ]) {
      node.addListener(() {
        if (!node.hasFocus) unawaited(flushDraft());
      });
    }
    unawaited(_restore());
  }

  @override
  void dispose() {
    _lookupDebounce?.cancel();
    _nom.dispose();
    _phone.dispose();
    _region.dispose();
    _departement.dispose();
    _ief.dispose();
    _whatsapp.dispose();
    _profession.dispose();
    _notes.dispose();
    _nomFocus.dispose();
    _phoneFocus.dispose();
    _regionFocus.dispose();
    _departementFocus.dispose();
    _iefFocus.dispose();
    _whatsappFocus.dispose();
    _professionFocus.dispose();
    _notesFocus.dispose();
    super.dispose();
  }

  Future<void> _restore() async {
    final DraftRepository drafts = ref.read(draftRepositoryProvider);

    if (widget.representantId != null) {
      final Representant? existing = await ref
          .read(referenceRepositoryProvider)
          .representantById(widget.representantId!);
      if (existing != null && mounted) {
        setState(() {
          _nom.text = existing.fullName;
          _phone.text = Phone.groupNational(Phone.digitsOf(existing.phoneE164));
          _departementId = existing.departementId;
          _iefId = existing.iefId;
          // La valeur brute, et non l'énumération : un état ajouté côté serveur
          // serait sinon rétrogradé en « non demandé » au premier
          // enregistrement, sans que personne ne le voie.
          _whatsappStatus = existing.whatsappStatus;
          _whatsapp.text = Phone.groupNational(
            Phone.digitsOf(existing.whatsappE164 ?? ''),
          );
          _setProfession(existing.profession ?? '');
          _notes.text = existing.notes ?? '';
        });
        await _labelDepartement(existing.departementId);
        if (existing.iefId != null) await _labelIef(existing.iefId!);
      }
      final DraftSnapshot? pending = await drafts.forEntity(
        formKey,
        widget.representantId!,
      );
      if (pending != null && mounted) _offer(pending);
      return;
    }

    DraftSnapshot? snapshot = await drafts.read(_draftId);
    if (snapshot == null && widget.draftId == null) {
      final DraftSnapshot? latest = await drafts.latestFor(formKey);
      if (latest != null && await _isCreationDraft(latest)) snapshot = latest;
    }
    if (snapshot == null || !mounted) return;
    _offer(snapshot);
  }

  Future<bool> _isCreationDraft(DraftSnapshot snapshot) async {
    final String? entityId = snapshot.entityId;
    if (entityId == null) return true;
    final Representant? existing = await ref
        .read(referenceRepositoryProvider)
        .representantById(entityId);
    return existing == null;
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
      _nom.text = (snapshot.values['fullName'] as String?) ?? '';
      _phone.text = (snapshot.values['phone'] as String?) ?? '';
      _regionId = snapshot.values['regionId'] as String?;
      _region.text = (snapshot.values['regionLabel'] as String?) ?? '';
      _departementId = snapshot.values['departementId'] as String?;
      _departement.text =
          (snapshot.values['departementLabel'] as String?) ?? '';
      _iefId = snapshot.values['iefId'] as String?;
      _ief.text = (snapshot.values['iefLabel'] as String?) ?? '';
      _whatsappStatus =
          (snapshot.values['whatsappStatus'] as String?) ??
          WhatsappStatus.nonDemande.code;
      _whatsapp.text = (snapshot.values['whatsapp'] as String?) ?? '';
      _setProfession((snapshot.values['profession'] as String?) ?? '');
      _notes.text = (snapshot.values['notes'] as String?) ?? '';
      _pendingRestore = null;
    });
    if (adopted) republishDraftRoute();
    _scheduleLookup();
  }

  Future<void> _labelDepartement(String id) async {
    final Departement? dep = await ref
        .read(referenceRepositoryProvider)
        .departementById(id);
    if (dep == null || !mounted) return;
    setState(() {
      _departement.text = dep.name;
      _regionId = dep.regionId;
      _region.text = dep.regionName;
    });
  }

  Future<void> _labelIef(String id) async {
    final Ief? ief = await ref.read(referenceRepositoryProvider).iefById(id);
    if (ief != null && mounted) setState(() => _ief.text = ief.name);
  }

  /// Une profession hors référentiel ne se marque PAS comme choisie : sinon
  /// elle se retrouverait seule dans la liste, qui se rouvrirait sur elle à
  /// chaque retour du focus.
  void _setProfession(String value) {
    _profession.text = value;
    _professionId = kProfessionsFrequentes.contains(value) ? value : null;
  }

  void _pickWhatsapp(String next) {
    unawaited(HapticFeedback.selectionClick());
    setState(() {
      _whatsappStatus = next;
      if (next != WhatsappStatus.autreNumero.code) _whatsapp.clear();
    });
    markDraftDirty();
    unawaited(flushDraft());
  }

  void _scheduleLookup() {
    _lookupDebounce?.cancel();
    _lookupDebounce = Timer(const Duration(milliseconds: 350), _runLookup);
  }

  Future<void> _runLookup() async {
    final String? e164 = Phone.toE164(_phone.text);
    if (e164 == null) {
      if (mounted) {
        setState(() {
          _localMatch = null;
          _remoteMatch = null;
        });
      }
      return;
    }

    final Representant? local = await ref
        .read(referenceRepositoryProvider)
        .findRepresentantByPhone(e164);
    if (!mounted) return;
    setState(() => _localMatch = local?.id == _entityId ? null : local);

    try {
      final RepresentantLookup remote = await ref
          .read(apiPortProvider)
          .lookupRepresentantByPhone(e164);
      if (!mounted) return;
      final bool autre = remote.found && remote.representant?.id != _entityId;
      setState(() => _remoteMatch = autre ? remote : null);
    } on ApiException {
      if (mounted) setState(() => _remoteMatch = null);
    }
  }

  bool get _creation => widget.representantId == null;

  /// Trois étapes, en création comme en correction : un écran qui empile onze
  /// champs se relit mal, et la correction se fait sur le terrain, debout.
  static const int _etapes = 3;
  int _etape = 0;

  static const List<String> _questions = <String>[
    'Qui est-ce ?',
    'Où travaille-t-il ?',
    'Pour l\'appeler',
  ];

  void _suivant() {
    FocusScope.of(context).unfocus();
    setState(() => _etape += 1);
    unawaited(flushDraft());
  }

  void _precedent() {
    FocusScope.of(context).unfocus();
    setState(() => _etape -= 1);
  }

  /// Ce qui manque pour passer à la suite, dit en une phrase. Null quand
  /// l'étape est complète : le bouton s'allume alors.
  String? get _manque {
    if (_etape == 0) {
      final bool nom = _nom.text.trim().length >= 2;
      final bool tel = Phone.toE164(_phone.text) != null;
      if (!nom && !tel) return 'Écrivez le nom et le numéro';
      if (!nom) return 'Écrivez le nom complet';
      if (!tel) return 'Écrivez le numéro de téléphone';
      return null;
    }
    if (_etape == 1) {
      return _departementId == null ? 'Choisissez le département' : null;
    }
    if (!_whatsappComplete) return 'Écrivez le numéro WhatsApp';
    if (_departementId == null) return 'Choisissez le département';
    if (_nom.text.trim().length < 2 || Phone.toE164(_phone.text) == null) {
      return 'Écrivez le nom et le numéro';
    }
    return null;
  }

  List<CpiRecapLine> get _recap => <CpiRecapLine>[
    CpiRecapLine('Nom complet', _nom.text),
    CpiRecapLine('Téléphone', _phone.text),
    CpiRecapLine('Département', _departement.text),
    CpiRecapLine(
      'WhatsApp',
      WhatsappStatus.parse(_whatsappStatus)?.label ?? _whatsappStatus,
    ),
  ];

  /// Un « autre numéro » sans numéro serait un état qui ment : la fiche dirait
  /// qu'il a WhatsApp ailleurs sans dire où.
  bool get _whatsappComplete =>
      _whatsappStatus != WhatsappStatus.autreNumero.code ||
      Phone.toE164(_whatsapp.text) != null;

  bool get _canSave =>
      _nom.text.trim().length >= 2 &&
      Phone.toE164(_phone.text) != null &&
      _departementId != null &&
      _whatsappComplete &&
      !_saving;

  /// [context] est pris SOUS la coque : le message passe par son `FToaster`.
  Future<void> _save(BuildContext context, {bool puisQualifier = false}) async {
    if (!_canSave) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final String? userId = await ref.read(tokenStoreProvider).readUserId();
      if (userId == null) {
        setState(() {
          _saving = false;
          _error = 'Session introuvable. Reconnectez-vous.';
        });
        return;
      }
      final String phoneE164 = Phone.toE164(_phone.text)!;
      final String notes = _notes.text.trim();
      final String profession = _profession.text.trim();

      // Le brouillon se jette AVANT l'écriture : sinon le minuteur armé par la
      // dernière frappe se déclenche pendant la transaction et réécrit la ligne
      // qu'elle vient de supprimer.
      discardDraft();
      if (widget.representantId != null) {
        await ref
            .read(writeRepositoryProvider)
            .updateRepresentant(
              id: _entityId,
              fullName: _nom.text.trim(),
              phoneE164: phoneE164,
              departementId: _departementId!,
              iefId: _iefId,
              notes: notes.isEmpty ? null : notes,
              whatsappStatus: _whatsappStatus,
              whatsappE164: Phone.toE164(_whatsapp.text),
              profession: profession.isEmpty ? null : profession,
              draftId: _draftId,
            );
      } else {
        await ref
            .read(writeRepositoryProvider)
            .createRepresentant(
              id: _entityId,
              fullName: _nom.text.trim(),
              phoneE164: phoneE164,
              departementId: _departementId!,
              iefId: _iefId,
              notes: notes.isEmpty ? null : notes,
              whatsappStatus: _whatsappStatus,
              whatsappE164: Phone.toE164(_whatsapp.text),
              profession: profession.isEmpty ? null : profession,
              createdById: userId,
              draftId: _draftId,
            );
      }

      await HapticFeedback.mediumImpact();
      ref.read(syncCoordinatorProvider.notifier).nudge();

      if (!context.mounted) return;
      context.pushReplacement(
        puisQualifier
            ? Routes.representantQualificationFor(_entityId)
            : Routes.newProspectFor(_entityId),
      );
    } on Object catch (e) {
      if (!context.mounted) return;
      final String message = _humanize(e);
      setState(() {
        _saving = false;
        _error = message;
      });
      _announceFailure(context, message);
    }
  }

  void _announceFailure(BuildContext context, String message) {
    unawaited(
      SemanticsService.sendAnnouncement(
        View.of(context),
        message,
        Directionality.of(context),
        assertiveness: Assertiveness.assertive,
      ),
    );
    cpiToast(context, message);
  }

  static String _humanize(Object error) {
    final String raw = error.toString();
    if (raw.contains('representants.phone_e164') ||
        raw.contains('representants_phone_unique')) {
      return 'Ce numéro est déjà enregistré sur cet appareil.';
    }
    return 'Enregistrement impossible. $raw';
  }

  @override
  Widget build(BuildContext context) {
    final List<Region> regions =
        ref.watch(regionsProvider).value ?? const <Region>[];
    final List<Departement> departements =
        ref.watch(departementsProvider(_regionId)).value ??
        const <Departement>[];
    final List<Ief> iefs =
        ref.watch(iefsProvider(_departementId)).value ?? const <Ief>[];

    final bool derniereEtape = _etape == _etapes - 1;
    final Widget ecran = CpiScaffold(
      title: _questions[_etape],
      showTitle: false,
      leading: _etape > 0
          ? CpiHeaderAction(
              icon: PhosphorIconsRegular.arrowLeft,
              label: 'Étape précédente',
              onPressed: _saving ? null : _precedent,
            )
          : const CpiBackButton(),
      footer: derniereEtape
          ? _SaveBar(
              // Les deux chemins enchaînent sur la saisie de prospects : le
              // libellé le dit, au lieu de laisser l'écran suivant surprendre.
              label: 'Enregistrer et saisir des prospects',
              enabled: _canSave,
              busy: _saving,
              onPressed: _save,
              secondLabel: 'Enregistrer et qualifier l\'appel',
              onSecond: (BuildContext context) =>
                  _save(context, puisQualifier: true),
              error: _error,
              subtitle: _manque,
            )
          : CpiActionBar(
              child: CpiButton(
                'Continuer',
                icon: PhosphorIconsRegular.arrowRight,
                subtitle: _manque,
                onPressed: _manque == null ? _suivant : null,
              ),
            ),
      body: Column(
        children: <Widget>[
          CpiStepHeader(
            step: _etape + 1,
            total: _etapes,
            question: _questions[_etape],
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                0,
                CpiSpacing.md,
                CpiSpacing.md,
              ),
              children: <Widget>[
                // Les deux bandeaux défilent AVEC le formulaire : posés
                // au-dessus d'un `Expanded`, ils prenaient sa place et la
                // colonne débordait de l'écran à 1,76×.
                ReferentialsBanner(missing: departements.isEmpty),
                if (_pendingRestore != null)
                  CpiResumeBanner(
                    label: (_pendingRestore!.values['fullName'] as String?)
                        ?.trim(),
                    onResume: () => _apply(_pendingRestore!),
                    onDiscard: () async {
                      await ref
                          .read(draftRepositoryProvider)
                          .delete(_pendingRestore!.draftId);
                      if (mounted) setState(() => _pendingRestore = null);
                    },
                  ),
                ..._champs(regions, departements, iefs),
                if (derniereEtape) ...<Widget>[
                  const SizedBox(height: CpiSpacing.md),
                  CpiRecap(lines: _recap),
                ],
              ],
            ),
          ),
        ],
      ),
    );

    // Le retour système remonte d'UNE étape : quitter l'écran depuis la
    // troisième perdrait les deux premières.
    return CpiStepScope(
      first: _etape == 0,
      onBack: _saving ? null : _precedent,
      child: ecran,
    );
  }

  List<Widget> _champs(
    List<Region> regions,
    List<Departement> departements,
    List<Ief> iefs,
  ) => switch (_etape) {
    0 => _identite(),
    1 => _lieu(regions, departements, iefs),
    _ => _contact(),
  };

  List<Widget> _identite() => <Widget>[
    CpiField(
      label: 'Nom complet',
      controller: _nom,
      focusNode: _nomFocus,
      hint: 'Ex. Mamadou Diallo',
      autofocus: _creation,
      textCapitalization: TextCapitalization.words,
      textInputAction: TextInputAction.next,
      onChanged: (String _) {
        markDraftDirty();
        setState(() {});
      },
    ),
    const SizedBox(height: CpiSpacing.md),
    PhoneField(
      controller: _phone,
      focusNode: _phoneFocus,
      onChanged: (String _) {
        markDraftDirty();
        _scheduleLookup();
        setState(() {});
      },
    ),
    if (_duplicate != null) ...<Widget>[
      const SizedBox(height: CpiSpacing.sm),
      _DuplicateBanner(
        name: _duplicate!.name,
        owner: _duplicate!.owner,
        onAddProspects: _duplicate!.representantId == null
            ? null
            : () => context.pushReplacement(
                Routes.newProspectFor(_duplicate!.representantId!),
              ),
      ),
    ],
  ];

  List<Widget> _lieu(
    List<Region> regions,
    List<Departement> departements,
    List<Ief> iefs,
  ) => <Widget>[
    // Masquée tant qu'aucun département ne porte de libellé de région : sur un
    // appareil qui n'a pas encore rejoué le pull complet du palier v8, l'étape
    // n'aurait rien à proposer.
    if (regions.isNotEmpty) ...<Widget>[
      LocalTypeahead(
        controller: _region,
        focusNode: _regionFocus,
        label: 'Région',
        hint: 'Dakar, Thiès, Tambacounda…',
        selectedId: _regionId,
        emptyHint: 'Aucun résultat',
        options: regions
            .map((Region r) => TypeaheadOption(id: r.id, label: r.name))
            .toList(growable: false),
        onChanged: (String _) {
          if (_regionId != null) {
            setState(() => _regionId = null);
          }
          markDraftDirty();
        },
        onSelected: (TypeaheadOption option) {
          setState(() {
            _regionId = option.id;
            _departementId = null;
            _departement.text = '';
            _iefId = null;
            _ief.text = '';
          });
          markDraftDirty();
          unawaited(flushDraft());
        },
      ),
      const SizedBox(height: CpiSpacing.md),
    ],
    LocalTypeahead(
      controller: _departement,
      focusNode: _departementFocus,
      label: 'Département',
      // La region ne fait que RETRECIR la liste: les 46 departements restent
      // choisissables sans elle.
      hint: 'Dakar, Thiès, Mbour…',
      selectedId: _departementId,
      textInputAction: TextInputAction.done,
      emptyHint: departements.isEmpty
          ? 'La liste n\'est pas encore arrivée. Touchez « Recevoir les listes ».'
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
        if (_departementId != null) {
          setState(() => _departementId = null);
        }
        markDraftDirty();
      },
      onSelected: (TypeaheadOption option) {
        setState(() {
          _departementId = option.id;
          _iefId = null;
          _ief.text = '';
        });
        markDraftDirty();
        unawaited(flushDraft());
      },
    ),
    const SizedBox(height: CpiSpacing.md),
    LocalTypeahead(
      controller: _ief,
      focusNode: _iefFocus,
      label: 'Inspection (facultatif)',
      hint: 'Almadies, Grand Dakar, Thiaroye…',
      selectedId: _iefId,
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
        if (_iefId != null) setState(() => _iefId = null);
        markDraftDirty();
      },
      onSelected: (TypeaheadOption option) {
        setState(() => _iefId = option.id);
        markDraftDirty();
        unawaited(flushDraft());
      },
    ),
  ];

  List<Widget> _contact() => <Widget>[
    _WhatsappPicker(
      status: _whatsappStatus,
      controller: _whatsapp,
      focusNode: _whatsappFocus,
      onPick: _pickWhatsapp,
      onNumberChanged: (String _) {
        markDraftDirty();
        setState(() {});
      },
    ),
    const SizedBox(height: CpiSpacing.md),
    LocalTypeahead(
      controller: _profession,
      focusNode: _professionFocus,
      label: 'Profession (facultatif)',
      hint: 'Instituteur, Proviseur, Inspecteur…',
      selectedId: _professionId,
      freeText: true,
      maxLength: kProfessionMaxLength,
      textInputAction: TextInputAction.done,
      options: kProfessionsFrequentes
          .map((String m) => TypeaheadOption(id: m, label: m))
          .toList(growable: false),
      onChanged: (String _) {
        if (_professionId != null) {
          setState(() => _professionId = null);
        }
        markDraftDirty();
      },
      onSelected: (TypeaheadOption option) {
        setState(() => _professionId = option.id);
        markDraftDirty();
        unawaited(flushDraft());
      },
    ),
    const SizedBox(height: CpiSpacing.md),
    CpiField(
      label: 'Notes (facultatif)',
      controller: _notes,
      focusNode: _notesFocus,
      maxLines: 5,
      maxLength: 2000,
      textCapitalization: TextCapitalization.sentences,
      onChanged: (String _) => markDraftDirty(),
    ),
  ];

  ({String name, String? owner, String? representantId})? get _duplicate {
    if (_localMatch != null) {
      return (
        name: _localMatch!.fullName,
        owner: null,
        representantId: _localMatch!.id,
      );
    }
    final RepresentantLookup? remote = _remoteMatch;
    if (remote == null || remote.representant == null) return null;
    return (
      name: remote.representant!.fullName,
      owner: remote.ownedByCommercialName,
      representantId: remote.representant!.id,
    );
  }
}

const List<String> kProfessionsFrequentes = <String>[
  'Instituteur',
  'Professeur',
  'Directeur d\'école',
  'Principal',
  'Proviseur',
  'Inspecteur',
  'Personnel administratif',
];

/// « Le même que son téléphone » est UNE puce, jamais neuf chiffres à
/// ressaisir. Aucune puce sélectionnée signifie « question non posée » : c'est
/// l'état de départ des 12 929 fiches, et il ne se confond pas avec « aucun ».
class _WhatsappPicker extends StatelessWidget {
  const _WhatsappPicker({
    required this.status,
    required this.controller,
    required this.focusNode,
    required this.onPick,
    required this.onNumberChanged,
  });

  final String status;
  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onPick;
  final ValueChanged<String> onNumberChanged;

  static const List<WhatsappStatus> _choix = <WhatsappStatus>[
    WhatsappStatus.memeNumero,
    WhatsappStatus.autreNumero,
    WhatsappStatus.aucun,
  ];

  /// Un état ajouté côté serveur prend sa propre puce : le faire disparaître
  /// reviendrait à le rétrograder en silence au prochain enregistrement.
  List<String> get _codes => <String>[
    for (final WhatsappStatus choix in _choix) choix.code,
    if (WhatsappStatus.parse(status) == null) status,
  ];

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      CpiChoiceGroup<String>(
        label: 'WhatsApp',
        description: status == WhatsappStatus.nonDemande.code
            ? 'Question non posée.'
            : null,
        value: status,
        options: <CpiChoice<String>>[
          for (final String code in _codes)
            CpiChoice<String>(
              value: code,
              label: WhatsappStatus.parse(code)?.label ?? code,
            ),
        ],
        // Retoucher la puce choisie repose la question : c'est le seul chemin
        // vers « non demandé » une fois qu'une réponse a été prise.
        onChanged: (String code) =>
            onPick(code == status ? WhatsappStatus.nonDemande.code : code),
      ),
      if (status == WhatsappStatus.autreNumero.code) ...<Widget>[
        const SizedBox(height: CpiSpacing.xs),
        PhoneField(
          controller: controller,
          focusNode: focusNode,
          label: 'Numéro WhatsApp',
          onChanged: onNumberChanged,
        ),
      ],
    ],
  );
}

class _DuplicateBanner extends StatelessWidget {
  const _DuplicateBanner({required this.name, this.owner, this.onAddProspects});

  final String name;
  final String? owner;
  final VoidCallback? onAddProspects;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      FAlert(
        icon: const Icon(PhosphorIconsRegular.warningCircle),
        title: const Text('Ce représentant existe déjà'),
        subtitle: Text(owner == null ? name : '$name · enregistré par $owner'),
      ),
      if (onAddProspects != null) ...<Widget>[
        const SizedBox(height: CpiSpacing.xs),
        Align(
          alignment: Alignment.centerRight,
          child: CpiButton(
            'Ajouter des prospects',
            variant: CpiButtonVariant.ghost,
            icon: PhosphorIconsRegular.userPlus,
            expand: false,
            onPressed: onAddProspects,
          ),
        ),
      ],
    ],
  );
}

class _SaveBar extends StatelessWidget {
  const _SaveBar({
    required this.label,
    required this.enabled,
    required this.busy,
    required this.onPressed,
    required this.secondLabel,
    required this.onSecond,
    this.error,
    this.subtitle,
  });

  final String label;
  final bool enabled;
  final bool busy;
  final ValueChanged<BuildContext> onPressed;

  /// La seconde sortie. Un representant qui n'a pas decroche, ou qui refuse,
  /// n'a pas de prospects a saisir : sans elle, l'appel ne se consigne nulle
  /// part depuis cet ecran.
  final String secondLabel;
  final ValueChanged<BuildContext> onSecond;

  final String? error;

  /// Ce qui manque, sous le libellé du bouton éteint.
  final String? subtitle;

  @override
  Widget build(BuildContext context) => CpiActionBar(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (error != null) ...<Widget>[
          Semantics(
            liveRegion: true,
            child: FAlert(
              variant: FAlertVariant.destructive,
              icon: const Icon(PhosphorIconsRegular.warningCircle),
              title: Text(error!),
            ),
          ),
          const SizedBox(height: CpiSpacing.xs),
        ],
        Builder(
          builder: (BuildContext context) => CpiButton(
            label,
            icon: PhosphorIconsRegular.check,
            loading: busy,
            subtitle: subtitle,
            onPressed: enabled ? () => onPressed(context) : null,
          ),
        ),
        const SizedBox(height: CpiSpacing.xs),
        Builder(
          builder: (BuildContext context) => CpiButton(
            secondLabel,
            variant: CpiButtonVariant.secondary,
            icon: PhosphorIconsRegular.phone,
            onPressed: enabled && !busy ? () => onSecond(context) : null,
          ),
        ),
      ],
    ),
  );
}
