import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/drafts/draft_form_mixin.dart';
import '../../../core/providers/app_providers.dart';
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
import '../../../ui/widgets/local_typeahead.dart';
import '../../../ui/widgets/offline_indicator.dart';
import '../../../ui/widgets/phone_field.dart';
import '../../../ui/widgets/referentials_banner.dart';

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
  final TextEditingController _duree = TextEditingController();
  final TextEditingController _canal = TextEditingController();

  final FocusNode _nomFocus = FocusNode();
  final FocusNode _prenomFocus = FocusNode();
  final FocusNode _phoneFocus = FocusNode();
  final FocusNode _banqueFocus = FocusNode();
  final FocusNode _syndicatFocus = FocusNode();
  final FocusNode _professionFocus = FocusNode();
  final FocusNode _dureeFocus = FocusNode();
  final FocusNode _canalFocus = FocusNode();

  late String _draftId = widget.draftId ?? Ids.newId();

  String? _representantId;
  String? _banqueId;
  String? _syndicatId;
  String? _type;
  String? _canalId;
  Representant? _representant;

  bool _saving = false;
  String? _error;
  String? _duplicateName;
  Timer? _lookupDebounce;
  DraftSnapshot? _pendingRestore;

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
      _nom.text.trim().isEmpty &&
      _prenom.text.trim().isEmpty &&
      _phone.text.trim().isEmpty &&
      _banqueId == null &&
      _syndicatId == null &&
      _type == null &&
      _canalId == null &&
      _profession.text.trim().isEmpty &&
      _duree.text.trim().isEmpty;

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
    'duree': _duree.text,
    'canalId': _canalId,
    'canalLabel': _canal.text,
  };

  @override
  void initState() {
    super.initState();
    _representantId = widget.representantId;
    for (final FocusNode node in <FocusNode>[
      _nomFocus,
      _prenomFocus,
      _phoneFocus,
      _banqueFocus,
      _syndicatFocus,
      _professionFocus,
      _dureeFocus,
      _canalFocus,
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
    for (final TextEditingController c in <TextEditingController>[
      _nom,
      _prenom,
      _phone,
      _banque,
      _syndicat,
      _profession,
      _duree,
      _canal,
    ]) {
      c.dispose();
    }
    for (final FocusNode n in <FocusNode>[
      _nomFocus,
      _prenomFocus,
      _phoneFocus,
      _banqueFocus,
      _syndicatFocus,
      _professionFocus,
      _dureeFocus,
      _canalFocus,
    ]) {
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
      _duree.text = (snapshot.values['duree'] as String?) ?? '';
      _canalId = snapshot.values['canalId'] as String?;
      _canal.text = (snapshot.values['canalLabel'] as String?) ?? '';
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

  void _scheduleLookup() {
    _lookupDebounce?.cancel();
    _lookupDebounce = Timer(const Duration(milliseconds: 300), () async {
      final String? e164 = Phone.toE164(_phone.text);
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

  /// Le nom, le numéro, et pour le Grand Public le secteur : rien d'autre. Un
  /// champ de plus rendu obligatoire et la saisie est abandonnée sur le terrain.
  bool get _canSave =>
      _nom.text.trim().isNotEmpty &&
      Phone.toE164(_phone.text) != null &&
      (widget.projet != 'GRAND_PUBLIC' || _type != null) &&
      !_saving;

  Future<void> _save({required bool andNext}) async {
    if (!_canSave) return;
    setState(() {
      _saving = true;
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
        phoneE164: Phone.toE164(_phone.text)!,
        banqueId: _banqueId,
        syndicatId: _syndicatId,
        representantId: _representantId,
        projet: widget.projet,
        type: _type,
        profession: _profession.text.trim(),
        dureeSystemeMois: int.tryParse(_duree.text.trim()),
        canalProvenanceId: _canalId,
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
          _profession.clear();
          _duree.clear();
          // Le secteur repart à vide : le garder ferait enregistrer la fiche
          // suivante sous celui de la précédente sans que personne le relise.
          _type = null;
          _duplicateName = null;
          _saving = false;
        });
        _nomFocus.requestFocus();
      } else {
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

  void _announceFailure(String message) {
    unawaited(
      SemanticsService.sendAnnouncement(
        View.of(context),
        message,
        Directionality.of(context),
        assertiveness: Assertiveness.assertive,
      ),
    );
    final ScaffoldMessengerState? messenger = ScaffoldMessenger.maybeOf(
      context,
    );
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

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final List<Banque> banques =
        ref.watch(banquesProvider).value ?? const <Banque>[];
    final List<Syndicat> syndicats =
        ref.watch(syndicatsProvider).value ?? const <Syndicat>[];
    final List<CanauxProvenanceData> canaux =
        ref.watch(canauxProvenanceProvider).value ??
        const <CanauxProvenanceData>[];
    final int count = _representantId == null
        ? 0
        : (ref.watch(prospectCountForProvider(_representantId!)).value ?? 0);
    final bool grandPublic = widget.projet == 'GRAND_PUBLIC';
    final String fallback = grandPublic
        ? Routes.grandPublic
        : Routes.historique;

    return CpiPopScope(
      fallback: fallback,
      child: Scaffold(
        appBar: AppBar(
          title: Text(grandPublic ? 'Nouveau prospect' : 'Saisie de prospects'),
          leading: CpiBackButton(fallback: fallback),
          actions: const <Widget>[
            OfflineIndicator(),
            SizedBox(width: CpiSpacing.xs),
          ],
          bottom: _contextStrip(
            context,
            text: _representant == null
                ? grandPublic
                      ? 'Projet Grand Public'
                      : 'Sans représentant'
                : '${_representant!.fullName} · '
                      '$count prospect${count > 1 ? 's' : ''} ajouté'
                      '${count > 1 ? 's' : ''}',
            style: theme.textTheme.bodySmall?.copyWith(color: cpi.accentOnDark),
          ),
        ),
        body: SafeArea(
          child: Column(
            children: <Widget>[
              Expanded(
                child: CustomScrollView(
                  slivers: <Widget>[
                    if (!grandPublic)
                      SliverToBoxAdapter(
                        child: ReferentialsBanner(
                          missing: banques.isEmpty || syndicats.isEmpty,
                        ),
                      ),
                    if (_pendingRestore != null)
                      SliverToBoxAdapter(
                        child: _ResumeStrip(
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
                          Row(
                            children: <Widget>[
                              Expanded(
                                child: TextField(
                                  controller: _prenom,
                                  focusNode: _prenomFocus,
                                  textCapitalization: TextCapitalization.words,
                                  textInputAction: TextInputAction.next,
                                  onChanged: (String _) {
                                    markDraftDirty();
                                    setState(() {});
                                  },
                                  decoration: const InputDecoration(
                                    labelText: 'Prénom',
                                  ),
                                ),
                              ),
                              const SizedBox(width: CpiSpacing.sm),
                              Expanded(
                                child: TextField(
                                  controller: _nom,
                                  focusNode: _nomFocus,
                                  autofocus: true,
                                  textCapitalization: TextCapitalization.words,
                                  textInputAction: TextInputAction.next,
                                  onChanged: (String _) {
                                    markDraftDirty();
                                    setState(() {});
                                  },
                                  decoration: const InputDecoration(
                                    labelText: 'Nom',
                                  ),
                                ),
                              ),
                            ],
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
                          if (grandPublic) ...<Widget>[
                            const SizedBox(height: CpiSpacing.md),
                            _ChampSecteur(
                              valeur: _type,
                              onChanged: (String? valeur) {
                                setState(() => _type = valeur);
                                markDraftDirty();
                                unawaited(flushDraft());
                              },
                            ),
                            const SizedBox(height: CpiSpacing.md),
                            TextField(
                              controller: _profession,
                              focusNode: _professionFocus,
                              textCapitalization: TextCapitalization.sentences,
                              textInputAction: TextInputAction.next,
                              onChanged: (String _) => markDraftDirty(),
                              decoration: const InputDecoration(
                                labelText: 'Profession',
                              ),
                            ),
                          ],
                          ...<Widget>[
                            const SizedBox(height: CpiSpacing.md),
                            LocalTypeahead(
                              controller: _banque,
                              focusNode: _banqueFocus,
                              label: grandPublic
                                  ? 'Banque de domiciliation'
                                  : 'Banque',
                              selectedId: _banqueId,
                              emptyHint: banques.isEmpty
                                  ? 'Aucune banque. Synchronisez.'
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
                                if (_banqueId != null) {
                                  setState(() => _banqueId = null);
                                }
                                markDraftDirty();
                              },
                              onSelected: (TypeaheadOption o) {
                                setState(() => _banqueId = o.id);
                                markDraftDirty();
                                unawaited(flushDraft());
                              },
                            ),
                            const SizedBox(height: CpiSpacing.md),
                            LocalTypeahead(
                              controller: _syndicat,
                              focusNode: _syndicatFocus,
                              label: 'Syndicat',
                              selectedId: _syndicatId,
                              textInputAction: TextInputAction.done,
                              emptyHint: syndicats.isEmpty
                                  ? 'Aucun syndicat. Synchronisez.'
                                  : 'Aucun résultat',
                              options: syndicats
                                  .map(
                                    (Syndicat s) => TypeaheadOption(
                                      id: s.id,
                                      label: s.name,
                                      secondary: s.sigle,
                                      keywords: <String>[
                                        s.sigle,
                                        if (s.secteur != null) s.secteur!,
                                      ],
                                    ),
                                  )
                                  .toList(growable: false),
                              onChanged: (String _) {
                                if (_syndicatId != null) {
                                  setState(() => _syndicatId = null);
                                }
                                markDraftDirty();
                              },
                              onSelected: (TypeaheadOption o) {
                                setState(() => _syndicatId = o.id);
                                markDraftDirty();
                                unawaited(flushDraft());
                              },
                            ),
                          ],
                          if (grandPublic) ...<Widget>[
                            const SizedBox(height: CpiSpacing.md),
                            TextField(
                              controller: _duree,
                              focusNode: _dureeFocus,
                              keyboardType: TextInputType.number,
                              textInputAction: TextInputAction.next,
                              onChanged: (String _) => markDraftDirty(),
                              decoration: const InputDecoration(
                                labelText: 'Durée du système',
                                suffixText: 'mois',
                              ),
                            ),
                            const SizedBox(height: CpiSpacing.md),
                            LocalTypeahead(
                              controller: _canal,
                              focusNode: _canalFocus,
                              label: 'Canal de provenance',
                              selectedId: _canalId,
                              textInputAction: TextInputAction.done,
                              emptyHint: canaux.isEmpty
                                  ? 'Aucun canal. Synchronisez.'
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
                                if (_canalId != null) {
                                  setState(() => _canalId = null);
                                }
                                markDraftDirty();
                              },
                              onSelected: (TypeaheadOption o) {
                                setState(() => _canalId = o.id);
                                markDraftDirty();
                                unawaited(flushDraft());
                              },
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(
                  CpiSpacing.md,
                  CpiSpacing.sm,
                  CpiSpacing.md,
                  CpiSpacing.md,
                ),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface,
                  border: Border(top: BorderSide(color: cpi.borderSubtle)),
                ),
                child: Column(
                  children: <Widget>[
                    if (_error != null) ...<Widget>[
                      Semantics(
                        liveRegion: true,
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Icon(
                              PhosphorIconsRegular.warningCircle,
                              size: CpiIconSize.sm,
                              color: theme.colorScheme.error,
                            ),
                            const SizedBox(width: CpiSpacing.xs),
                            Expanded(
                              child: Text(
                                _error!,
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
                      onPressed: _canSave ? () => _save(andNext: true) : null,
                      icon: const Icon(
                        PhosphorIconsRegular.arrowRight,
                        size: CpiIconSize.md,
                      ),
                      label: const Text('Enregistrer et suivant'),
                    ),
                    const SizedBox(height: CpiSpacing.xs),
                    OutlinedButton(
                      onPressed: _canSave ? () => _save(andNext: false) : null,
                      child: const Text('Enregistrer et terminer'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

PreferredSizeWidget _contextStrip(
  BuildContext context, {
  required String text,
  required TextStyle? style,
}) {
  const int maxLines = 2;
  final double available = MediaQuery.sizeOf(context).width - CpiSpacing.md * 2;
  final TextPainter painter = TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: Directionality.of(context),
    textScaler: MediaQuery.textScalerOf(context),
    maxLines: maxLines,
  )..layout(maxWidth: available < 0 ? 0 : available);
  final double measured = painter.height;
  painter.dispose();

  return PreferredSize(
    preferredSize: Size.fromHeight(measured + CpiSpacing.xs),
    child: Padding(
      padding: const EdgeInsets.only(
        left: CpiSpacing.md,
        right: CpiSpacing.md,
        bottom: CpiSpacing.xs,
      ),
      child: Align(
        alignment: AlignmentDirectional.centerStart,
        child: Text(
          text,
          style: style,
          maxLines: maxLines,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    ),
  );
}

/// Le secteur, seule question obligatoire du Grand Public en plus du nom et du
/// numéro : c'est lui qui décide du mode de paiement proposé ensuite.
class _ChampSecteur extends StatelessWidget {
  const _ChampSecteur({required this.valeur, required this.onChanged});

  final String? valeur;
  final ValueChanged<String?> onChanged;

  static const Map<String, String> _libelles = <String, String>{
    'FONCTIONNAIRE': 'Fonctionnaire',
    'SECTEUR_PRIVE': 'Secteur privé',
    'INFORMEL': 'Informel',
    'DIASPORA': 'Diaspora',
  };

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text('Secteur', style: theme.textTheme.labelLarge),
        const SizedBox(height: CpiSpacing.xs),
        Wrap(
          spacing: CpiSpacing.xs,
          runSpacing: CpiSpacing.xs,
          children: _libelles.entries
              .map(
                (MapEntry<String, String> e) => ChoiceChip(
                  label: Text(e.value),
                  selected: valeur == e.key,
                  // Un secteur se corrige en touchant un autre choix, pas en
                  // le retouchant : le vider laisserait une fiche invalide.
                  onSelected: (bool choisi) {
                    if (choisi) onChanged(e.key);
                  },
                  padding: const EdgeInsets.symmetric(
                    horizontal: CpiSpacing.sm,
                    vertical: CpiSpacing.xs,
                  ),
                ),
              )
              .toList(growable: false),
        ),
      ],
    );
  }
}

class _ResumeStrip extends StatelessWidget {
  const _ResumeStrip({required this.onResume, required this.onDiscard});

  final VoidCallback onResume;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    final CpiColors cpi = context.cpi;
    return Container(
      width: double.infinity,
      color: cpi.infoSurface,
      padding: const EdgeInsets.symmetric(
        horizontal: CpiSpacing.md,
        vertical: CpiSpacing.xxs,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            'Saisie non terminée',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: cpi.info),
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
