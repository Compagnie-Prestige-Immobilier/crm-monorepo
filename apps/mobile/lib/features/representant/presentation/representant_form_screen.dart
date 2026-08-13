import 'dart:async';

import 'package:flutter/material.dart';
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
import '../../../ui/widgets/phone_field.dart';

/// Nouveau représentant.
///
/// Trois champs, et un mécanisme qui compte plus que les trois : la **détection
/// de doublon vivante** sur le téléphone. Un représentant saisi deux fois, c'est
/// une fusion 409 côté serveur, une attribution à arbitrer et, au bout de la
/// chaîne, une commission fausse. Le prévenir à la saisie coûte une requête ; le
/// réparer après coup coûte une conversation avec deux commerciaux.
///
/// La détection interroge **d'abord la base locale** — instantanée, disponible
/// hors ligne — puis le serveur si le réseau répond. L'ordre n'est pas
/// négociable : le résultat local doit s'afficher sans attendre le réseau, sinon
/// la fonctionnalité disparaît précisément là où elle sert.
class RepresentantFormScreen extends ConsumerStatefulWidget {
  const RepresentantFormScreen({super.key, this.draftId, this.representantId});

  /// Référence au brouillon, transportée par l'URL (`?draft=<id>`).
  final String? draftId;

  /// Renseigné en modification.
  final String? representantId;

  @override
  ConsumerState<RepresentantFormScreen> createState() => _RepresentantFormScreenState();
}

class _RepresentantFormScreenState extends ConsumerState<RepresentantFormScreen>
    with DraftFormMixin<RepresentantFormScreen> {
  static const String formKey = 'representant.create';

  final TextEditingController _nom = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _departement = TextEditingController();
  final FocusNode _nomFocus = FocusNode();
  final FocusNode _phoneFocus = FocusNode();
  final FocusNode _departementFocus = FocusNode();

  late final String _draftId = widget.draftId ?? Ids.newId();
  late final String _entityId = widget.representantId ?? Ids.newId();

  String? _departementId;
  bool _saving = false;
  String? _error;

  /// Doublon détecté : localement, ou par le serveur.
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
      _nom.text.trim().isEmpty && _phone.text.trim().isEmpty && _departementId == null;

  /// En création seulement : en modification, la fiche existe déjà et c'est son
  /// identifiant, pas un brouillon, qui porte la restauration.
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
  };

  @override
  void initState() {
    super.initState();
    // Vider sur perte de focus, en plus de la traîne : quitter un champ est le
    // moment où l'utilisateur considère sa valeur acquise.
    for (final FocusNode node in <FocusNode>[_nomFocus, _phoneFocus, _departementFocus]) {
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
    _nomFocus.dispose();
    _phoneFocus.dispose();
    _departementFocus.dispose();
    super.dispose();
  }

  Future<void> _restore() async {
    if (widget.representantId != null) {
      final Representant? existing = await ref
          .read(referenceRepositoryProvider)
          .representantById(widget.representantId!);
      if (existing != null && mounted) {
        setState(() {
          _nom.text = existing.fullName;
          _phone.text = Phone.groupNational(Phone.digitsOf(existing.phoneE164));
          _departementId = existing.departementId;
        });
        await _labelDepartement(existing.departementId);
      }
      return;
    }

    final DraftSnapshot? snapshot = await ref
        .read(draftRepositoryProvider)
        .read(_draftId);
    if (snapshot == null || !mounted) return;

    switch (snapshot.age) {
      case DraftAge.crash:
        // Moins de 60 s : ce n'est pas un abandon, c'est un plantage ou une
        // éjection mémoire. On restaure sans rien demander.
        _apply(snapshot);
      case DraftAge.resumable:
        setState(() => _pendingRestore = snapshot);
      case DraftAge.stale:
        break;
    }
  }

  void _apply(DraftSnapshot snapshot) {
    setState(() {
      _nom.text = (snapshot.values['fullName'] as String?) ?? '';
      _phone.text = (snapshot.values['phone'] as String?) ?? '';
      _departementId = snapshot.values['departementId'] as String?;
      _departement.text = (snapshot.values['departementLabel'] as String?) ?? '';
      _pendingRestore = null;
    });
    _scheduleLookup();
  }

  Future<void> _labelDepartement(String id) async {
    final Departement? dep = await ref
        .read(referenceRepositoryProvider)
        .departementById(id);
    if (dep != null && mounted) setState(() => _departement.text = dep.name);
  }

  // ── Détection de doublon ───────────────────────────────────────────────────

  void _scheduleLookup() {
    _lookupDebounce?.cancel();
    // 350 ms : assez pour ne pas interroger à chaque chiffre, assez court pour
    // que la réponse arrive avant que l'utilisateur n'atteigne le champ suivant.
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

    // Le serveur est un BONUS. Son échec ne doit rien casser : hors ligne, la
    // détection locale reste la seule et elle suffit à éviter la plupart des
    // doublons, puisqu'un commercial ressaisit presque toujours ses propres
    // fiches.
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

  // ── Enregistrement ─────────────────────────────────────────────────────────

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
              createdById: userId,
              draftId: _draftId,
            );
      }

      // Le brouillon a été supprimé DANS la transaction d'écriture ; réécrire
      // maintenant le ferait réapparaître, et l'écran proposerait de reprendre
      // une saisie déjà enregistrée.
      discardDraft();
      await HapticFeedback.mediumImpact();
      ref.read(syncCoordinatorProvider.notifier).nudge();

      if (!mounted) return;
      // On enchaîne directement sur la saisie de prospects : c'est le geste
      // suivant dans 100 % des cas réels. Renvoyer à l'accueil obligerait à
      // retrouver le représentant qu'on vient de créer.
      context.pushReplacement(Routes.newProspectFor(_entityId));
    } on Object catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = _humanize(e);
      });
    }
  }

  static String _humanize(Object error) {
    final String raw = error.toString();
    if (raw.contains('representants_phone_unique')) {
      return 'Ce numéro est déjà enregistré sur cet appareil.';
    }
    return 'Enregistrement impossible. $raw';
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final List<Departement> departements =
        ref.watch(departementsProvider).value ?? const <Departement>[];

    return CpiPopScope(
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            widget.representantId == null
                ? 'Nouveau représentant'
                : 'Modifier le représentant',
          ),
          leading: const CpiBackButton(),
        ),
        body: SafeArea(
          child: Column(
            children: <Widget>[
              if (_pendingRestore != null)
                _ResumeBanner(
                  label: (_pendingRestore!.values['fullName'] as String?)?.trim(),
                  onResume: () => _apply(_pendingRestore!),
                  onDiscard: () async {
                    await ref.read(draftRepositoryProvider).delete(_draftId);
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
                        // Retaper invalide la sélection : sans ça, corriger
                        // « Dakar » en « Dagana » garderait l'identifiant de
                        // Dakar tout en affichant Dagana.
                        if (_departementId != null) {
                          setState(() => _departementId = null);
                        }
                        markDraftDirty();
                      },
                      onSelected: (TypeaheadOption option) {
                        setState(() => _departementId = option.id);
                        markDraftDirty();
                        unawaited(flushDraft());
                      },
                    ),
                    if (_error != null) ...<Widget>[
                      const SizedBox(height: CpiSpacing.md),
                      Text(
                        _error!,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.error,
                        ),
                      ),
                    ],
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

/// Bandeau « ce représentant existe déjà ».
///
/// Il ne bloque pas la saisie : le commercial peut avoir une raison de créer
/// quand même (homonyme, numéro recyclé). Il propose l'action utile — aller
/// ajouter des prospects à la fiche existante — au lieu de se contenter d'un
/// avertissement dont on ne peut rien faire.
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
                // `accentText` (#856011) et jamais `accent` (#C8921A) : l'or de
                // surface fait 2,77:1 et échoue AA (docs/design.md §2.3).
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

/// Bandeau de reprise, **non bloquant**.
///
/// Non bloquant : une boîte de dialogue modale au démarrage d'un écran de saisie
/// est un obstacle avant même d'avoir compris ce qu'on regarde. Le bandeau
/// laisse commencer à taper et disparaît tout seul.
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
      child: Row(
        children: <Widget>[
          Icon(PhosphorIconsRegular.arrowCounterClockwise, size: 18, color: cpi.info),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Text(
              'Saisie non terminée : $who',
              style: theme.textTheme.bodySmall?.copyWith(color: cpi.info),
            ),
          ),
          TextButton(onPressed: onResume, child: const Text('Reprendre')),
          TextButton(onPressed: onDiscard, child: const Text('Supprimer')),
        ],
      ),
    );
  }
}

/// Barre d'action ancrée en bas.
///
/// En bas et pleine largeur : l'app se tient d'une main, debout ; une action
/// posée en haut d'un écran de 6,5 pouces est hors d'atteinte du pouce.
class _SaveBar extends StatelessWidget {
  const _SaveBar({
    required this.label,
    required this.enabled,
    required this.busy,
    required this.onPressed,
  });

  final String label;
  final bool enabled;
  final bool busy;
  final VoidCallback onPressed;

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
      child: FilledButton.icon(
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
    );
  }
}
