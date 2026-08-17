import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/drafts/draft_form_mixin.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/sync/api_port.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/ids.dart';
import '../../../core/utils/phone.dart';
import '../../../data/local/database.dart';
import '../../../data/repositories/draft_repository.dart';
import '../../../ui/widgets/local_typeahead.dart';
import '../../../ui/widgets/offline_indicator.dart';
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
  ConsumerState<RepresentantFormScreen> createState() => _RepresentantFormScreenState();
}

class _RepresentantFormScreenState extends ConsumerState<RepresentantFormScreen>
    with DraftFormMixin<RepresentantFormScreen> {
  static const String formKey = 'representant.create';

  final TextEditingController _nom = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _departement = TextEditingController();
  final TextEditingController _ief = TextEditingController();
  final FocusNode _nomFocus = FocusNode();
  final FocusNode _phoneFocus = FocusNode();
  final FocusNode _departementFocus = FocusNode();
  final FocusNode _iefFocus = FocusNode();

  late String _draftId = widget.draftId ?? Ids.newId();
  late final String _entityId = widget.representantId ?? Ids.newId();

  String? _departementId;
  String? _iefId;
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
      _departementId == null &&
      _iefId == null;

  @override
  String? draftRouteWithId() => widget.draftId == null && widget.representantId == null
      ? Routes.newRepresentantWithDraft(_draftId)
      : null;

  @override
  Map<String, Object?> collectDraftValues() => <String, Object?>{
    'fullName': _nom.text,
    'phone': _phone.text,
    'departementId': _departementId,
    'departementLabel': _departement.text,
    'iefId': _iefId,
    'iefLabel': _ief.text,
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
      _departementFocus,
      _iefFocus,
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
    _departement.dispose();
    _ief.dispose();
    _nomFocus.dispose();
    _phoneFocus.dispose();
    _departementFocus.dispose();
    _iefFocus.dispose();
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
      _departementId = snapshot.values['departementId'] as String?;
      _departement.text = (snapshot.values['departementLabel'] as String?) ?? '';
      _iefId = snapshot.values['iefId'] as String?;
      _ief.text = (snapshot.values['iefLabel'] as String?) ?? '';
      _pendingRestore = null;
    });
    if (adopted) republishDraftRoute();
    _scheduleLookup();
  }

  Future<void> _labelDepartement(String id) async {
    final Departement? dep = await ref
        .read(referenceRepositoryProvider)
        .departementById(id);
    if (dep != null && mounted) setState(() => _departement.text = dep.name);
  }

  Future<void> _labelIef(String id) async {
    final Ief? ief = await ref.read(referenceRepositoryProvider).iefById(id);
    if (ief != null && mounted) setState(() => _ief.text = ief.name);
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
      setState(() => _remoteMatch = remote.found ? remote : null);
    } on ApiException {
      if (mounted) setState(() => _remoteMatch = null);
    }
  }


  bool get _canSave =>
      _nom.text.trim().length >= 2 &&
      Phone.toE164(_phone.text) != null &&
      _departementId != null &&
      !_saving;

  Future<void> _save() async {
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

      if (widget.representantId != null) {
        await ref
            .read(writeRepositoryProvider)
            .updateRepresentant(
              id: _entityId,
              fullName: _nom.text.trim(),
              phoneE164: phoneE164,
              departementId: _departementId!,
              iefId: _iefId,
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
              createdById: userId,
              draftId: _draftId,
            );
      }

      discardDraft();
      await HapticFeedback.mediumImpact();
      ref.read(syncCoordinatorProvider.notifier).nudge();

      if (!mounted) return;
      context.pushReplacement(Routes.newProspectFor(_entityId));
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

  void _announceFailure(String message) {
    unawaited(
      SemanticsService.sendAnnouncement(
        View.of(context),
        message,
        Directionality.of(context),
        assertiveness: Assertiveness.assertive,
      ),
    );
    final ScaffoldMessengerState? messenger = ScaffoldMessenger.maybeOf(context);
    messenger
      ?..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: Theme.of(context).colorScheme.error,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 6),
        ),
      );
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
    final List<Departement> departements =
        ref.watch(departementsProvider).value ?? const <Departement>[];
    final List<Ief> iefs = ref.watch(iefsProvider(_departementId)).value ?? const <Ief>[];

    return CpiPopScope(
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            widget.representantId == null
                ? 'Nouveau représentant'
                : 'Modifier le représentant',
          ),
          leading: const CpiBackButton(),
          actions: const <Widget>[
            OfflineIndicator(),
            SizedBox(width: CpiSpacing.xs),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: <Widget>[
              ReferentialsBanner(missing: departements.isEmpty),
              if (_pendingRestore != null)
                _ResumeBanner(
                  label: (_pendingRestore!.values['fullName'] as String?)?.trim(),
                  onResume: () => _apply(_pendingRestore!),
                  onDiscard: () async {
                    await ref
                        .read(draftRepositoryProvider)
                        .delete(_pendingRestore!.draftId);
                    if (mounted) setState(() => _pendingRestore = null);
                  },
                ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(CpiSpacing.md),
                  children: <Widget>[
                    TextField(
                      controller: _nom,
                      focusNode: _nomFocus,
                      autofocus: widget.representantId == null,
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      onChanged: (String _) {
                        markDraftDirty();
                        setState(() {});
                      },
                      decoration: const InputDecoration(
                        labelText: 'Nom complet',
                        hintText: 'Mamadou Diallo',
                      ),
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
                    const SizedBox(height: CpiSpacing.md),
                    LocalTypeahead(
                      controller: _departement,
                      focusNode: _departementFocus,
                      label: 'Département',
                      hint: 'Dakar, Thiès, Mbour…',
                      selectedId: _departementId,
                      textInputAction: TextInputAction.done,
                      emptyHint: departements.isEmpty
                          ? 'Aucun département. Synchronisez.'
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
                      label: 'IEF (facultatif)',
                      hint: _departementId == null
                          ? 'Choisissez d’abord le département'
                          : 'Almadies, Grand Dakar, Thiaroye…',
                      selectedId: _iefId,
                      textInputAction: TextInputAction.done,
                      emptyHint: iefs.isEmpty
                          ? 'Aucune IEF pour ce département.'
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
                  ],
                ),
              ),
              _SaveBar(
                label: widget.representantId == null
                    ? 'Enregistrer et saisir des prospects'
                    : 'Enregistrer',
                enabled: _canSave,
                busy: _saving,
                onPressed: _save,
                error: _error,
              ),
            ],
          ),
        ),
      ),
    );
  }

  ({String name, String? owner, String? representantId})? get _duplicate {
    if (_localMatch != null) {
      return (name: _localMatch!.fullName, owner: null, representantId: _localMatch!.id);
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

class _DuplicateBanner extends StatelessWidget {
  const _DuplicateBanner({required this.name, this.owner, this.onAddProspects});

  final String name;
  final String? owner;
  final VoidCallback? onAddProspects;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    return Container(
      padding: const EdgeInsets.all(CpiSpacing.sm),
      decoration: BoxDecoration(
        color: cpi.accentSurface,
        borderRadius: CpiRadius.brMd,
        border: Border.all(color: cpi.accentBorder.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(
                PhosphorIconsRegular.warningCircle,
                size: 20,
                color: cpi.accentText,
              ),
              const SizedBox(width: CpiSpacing.xs),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Ce représentant existe déjà',
                      style: theme.textTheme.titleSmall?.copyWith(color: cpi.accentText),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      owner == null ? name : '$name · enregistré par $owner',
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (onAddProspects != null) ...<Widget>[
            const SizedBox(height: CpiSpacing.xs),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: onAddProspects,
                icon: const Icon(PhosphorIconsRegular.userPlus, size: 18),
                label: const Text('Ajouter des prospects'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ResumeBanner extends StatelessWidget {
  const _ResumeBanner({required this.onResume, required this.onDiscard, this.label});

  final String? label;
  final VoidCallback onResume;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final String who = (label == null || label!.isEmpty) ? 'la saisie' : label!;
    return Container(
      width: double.infinity,
      color: cpi.infoSurface,
      padding: const EdgeInsets.symmetric(
        horizontal: CpiSpacing.md,
        vertical: CpiSpacing.xs,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(PhosphorIconsRegular.arrowCounterClockwise, size: 18, color: cpi.info),
              const SizedBox(width: CpiSpacing.xs),
              Expanded(
                child: Text(
                  'Saisie non terminée : $who',
                  style: theme.textTheme.bodySmall?.copyWith(color: cpi.info),
                ),
              ),
            ],
          ),
          Wrap(
            alignment: WrapAlignment.end,
            children: <Widget>[
              TextButton(onPressed: onResume, child: const Text('Reprendre')),
              TextButton(onPressed: onDiscard, child: const Text('Supprimer')),
            ],
          ),
        ],
      ),
    );
  }
}

class _SaveBar extends StatelessWidget {
  const _SaveBar({
    required this.label,
    required this.enabled,
    required this.busy,
    required this.onPressed,
    this.error,
  });

  final String label;
  final bool enabled;
  final bool busy;
  final VoidCallback onPressed;

  final String? error;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.sm,
        CpiSpacing.md,
        CpiSpacing.md,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(top: BorderSide(color: context.cpi.borderSubtle)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (error != null) ...<Widget>[
            Semantics(
              liveRegion: true,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Icon(
                    PhosphorIconsRegular.warningCircle,
                    size: 18,
                    color: theme.colorScheme.error,
                  ),
                  const SizedBox(width: CpiSpacing.xs),
                  Expanded(
                    child: Text(
                      error!,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.error,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: CpiSpacing.xs),
          ],
          FilledButton.icon(
            onPressed: enabled ? onPressed : null,
            icon: busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(PhosphorIconsRegular.check, size: 20),
            label: Text(label),
          ),
        ],
      ),
    );
  }
}
