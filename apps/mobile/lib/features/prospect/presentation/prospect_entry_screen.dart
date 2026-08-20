import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/drafts/draft_form_mixin.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
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

class ProspectEntryScreen extends ConsumerStatefulWidget {
  const ProspectEntryScreen({super.key, this.representantId, this.draftId});

  final String? representantId;
  final String? draftId;

  @override
  ConsumerState<ProspectEntryScreen> createState() => _ProspectEntryScreenState();
}

class _ProspectEntryScreenState extends ConsumerState<ProspectEntryScreen>
    with DraftFormMixin<ProspectEntryScreen> {
  static const String formKey = 'prospect.create';

  final TextEditingController _nom = TextEditingController();
  final TextEditingController _prenom = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _banque = TextEditingController();
  final TextEditingController _syndicat = TextEditingController();

  final FocusNode _nomFocus = FocusNode();
  final FocusNode _prenomFocus = FocusNode();
  final FocusNode _phoneFocus = FocusNode();
  final FocusNode _banqueFocus = FocusNode();
  final FocusNode _syndicatFocus = FocusNode();

  late String _draftId = widget.draftId ?? Ids.newId();

  String? _representantId;
  String? _banqueId;
  String? _syndicatId;
  Representant? _representant;

  bool _saving = false;
  String? _error;
  String? _duplicateName;
  Timer? _lookupDebounce;
  DraftSnapshot? _pendingRestore;

  @override
  String get draftId => _draftId;

  @override
  String get draftFormKey => formKey;

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
      _syndicatId == null;

  @override
  String? draftRouteWithId() => widget.draftId == null && widget.representantId != null
      ? Routes.newProspectFor(widget.representantId!, draftId: _draftId)
      : null;

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
    ]) {
      c.dispose();
    }
    for (final FocusNode n in <FocusNode>[
      _nomFocus,
      _prenomFocus,
      _phoneFocus,
      _banqueFocus,
      _syndicatFocus,
    ]) {
      n.dispose();
    }
    super.dispose();
  }

  Future<void> _restore() async {
    final DraftRepository drafts = ref.read(draftRepositoryProvider);
    DraftSnapshot? snapshot = await drafts.read(_draftId);
    if (snapshot == null && widget.draftId == null) {
      final DraftSnapshot? latest = await drafts.latestFor(formKey);
      if (latest != null && _acceptsParent(latest)) snapshot = latest;
    }
    if (snapshot != null && mounted) _offer(snapshot);
    await _loadRepresentant();
  }

  bool _acceptsParent(DraftSnapshot snapshot) {
    final String? mine = widget.representantId;
    if (mine == null) return true;
    final Object? theirs = snapshot.parentId ?? snapshot.values['representantId'];
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
      _representantId = _representantId ?? snapshot.values['representantId'] as String?;
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

  bool get _canSave =>
      _representantId != null &&
      _nom.text.trim().isNotEmpty &&
      _prenom.text.trim().isNotEmpty &&
      Phone.toE164(_phone.text) != null &&
      _banqueId != null &&
      _syndicatId != null &&
      !_saving;

  Future<void> _save({required bool andNext}) async {
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
      // Le brouillon se jette AVANT l'écriture : sinon le minuteur armé par la
      // dernière frappe se déclenche pendant la transaction et réécrit la ligne
      // qu'elle vient de supprimer.
      discardDraft();
      await ref
          .read(writeRepositoryProvider)
          .createProspect(
            nom: _nom.text.trim(),
            prenom: _prenom.text.trim(),
            phoneE164: Phone.toE164(_phone.text)!,
            banqueId: _banqueId!,
            syndicatId: _syndicatId!,
            representantId: _representantId!,
            createdById: userId,
            draftId: _draftId,
          );

      await HapticFeedback.mediumImpact();
      ref.read(syncCoordinatorProvider.notifier).nudge();

      if (!mounted) return;
      if (andNext) {
        setState(() {
          _nom.clear();
          _prenom.clear();
          _phone.clear();
          _duplicateName = null;
          _saving = false;
        });
        _nomFocus.requestFocus();
      } else {
        popOrHome(context, fallback: Routes.historique);
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
    if (raw.contains('prospects.phone_e164') || raw.contains('prospects_phone_unique')) {
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

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final List<Banque> banques = ref.watch(banquesProvider).value ?? const <Banque>[];
    final List<Syndicat> syndicats =
        ref.watch(syndicatsProvider).value ?? const <Syndicat>[];
    final int count = _representantId == null
        ? 0
        : (ref.watch(prospectCountForProvider(_representantId!)).value ?? 0);

    return CpiPopScope(
      fallback: Routes.historique,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Saisie de prospects'),
          leading: const CpiBackButton(fallback: Routes.historique),
          actions: const <Widget>[
            OfflineIndicator(),
            SizedBox(width: CpiSpacing.xs),
          ],
          bottom: _contextStrip(
            context,
            text: _representant == null
                ? 'Aucun représentant sélectionné'
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
                    if (_representantId == null)
                      const SliverFillRemaining(
                        hasScrollBody: false,
                        child: _MissingRepresentant(),
                      )
                    else
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
                                    decoration: const InputDecoration(labelText: 'Nom'),
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
                                    size: 16,
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
                            const SizedBox(height: CpiSpacing.md),
                            LocalTypeahead(
                              controller: _banque,
                              focusNode: _banqueFocus,
                              label: 'Banque',
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
                        ),
                      ),
                  ],
                ),
              ),
              if (_representantId != null)
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
                                size: 18,
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
                        icon: const Icon(PhosphorIconsRegular.arrowRight, size: 20),
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

class _MissingRepresentant extends StatelessWidget {
  const _MissingRepresentant();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(CpiSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              PhosphorIconsDuotone.usersThree,
              size: 56,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: CpiSpacing.md),
            Text(
              'Aucun représentant sélectionné',
              textAlign: TextAlign.center,
              style: theme.textTheme.titleSmall,
            ),
            const SizedBox(height: CpiSpacing.lg),
            FilledButton(
              onPressed: () => popOrHome(context, fallback: Routes.representants),
              child: const Text('Voir mes représentants'),
            ),
          ],
        ),
      ),
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
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cpi.info),
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
