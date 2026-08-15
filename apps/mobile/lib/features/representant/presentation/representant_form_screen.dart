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

/// Nouveau représentant.
///
/// Trois champs, et un mécanisme qui compte plus que les trois : la **détection
/// de doublon vivante** sur le téléphone. Un représentant saisi deux fois, c'est
/// une fusion 409 côté serveur, une attribution à arbitrer et, au bout de la
/// chaîne, une commission fausse. Le prévenir à la saisie coûte une requête ; le
/// réparer après coup coûte une conversation avec deux commerciaux.
///
/// La détection interroge **d'abord la base locale** : instantanée, disponible
/// hors ligne : puis le serveur si le réseau répond. L'ordre n'est pas
/// négociable : le résultat local doit s'afficher sans attendre le réseau, sinon
/// la fonctionnalité disparaît précisément là où elle sert.
class RepresentantFormScreen extends ConsumerStatefulWidget {
  const RepresentantFormScreen({
    super.key,
    this.draftId,
    this.representantId,
    this.prefillName,
    this.prefillPhone,
  });

  /// Référence au brouillon, transportée par l'URL (`?draft=<id>`).
  final String? draftId;

  /// Renseigné en modification.
  final String? representantId;

  /// Recherche restée sans résultat dans le sélecteur, reprise telle quelle :
  /// la retaper est un geste de plus au moment où l'utilisateur en a déjà fait
  /// un pour rien.
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

  /// Non `final` : quand un brouillon est retrouvé sous un AUTRE identifiant
  /// (ouverture depuis un bouton, retour depuis le sélecteur), l'écran l'adopte
  /// au lieu d'en créer un second. Sans adoption, la reprise écrirait désormais
  /// sous l'identifiant neuf et laisserait l'ancienne ligne orpheline sept
  /// jours durant.
  late String _draftId = widget.draftId ?? Ids.newId();
  late final String _entityId = widget.representantId ?? Ids.newId();

  String? _departementId;
  String? _iefId;
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

  /// Vide veut dire « rien à sauver », et le référentiel choisi COMPTE.
  ///
  /// Sélectionner un département dans une liste est le geste le plus lent d'un
  /// formulaire tactile : ne le considérer comme rien parce que le nom n'est pas
  /// encore tapé revenait à jeter précisément ce qu'on voulait protéger.
  @override
  bool get draftIsEmpty =>
      _nom.text.trim().isEmpty &&
      _phone.text.trim().isEmpty &&
      _departementId == null &&
      _iefId == null;

  /// En création seulement : en modification, la fiche existe déjà et c'est son
  /// identifiant : porté par `?id=`, et retrouvé par
  /// [DraftRepository.forEntity] : qui porte la restauration.
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
    // Vider sur perte de focus, en plus de la traîne : quitter un champ est le
    // moment où l'utilisateur considère sa valeur acquise.
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

  /// Retrouve la saisie inachevée, quel que soit le chemin d'arrivée.
  ///
  /// ═══ CE QUE CE MÉCANISME NE FAISAIT PAS ═══
  ///
  /// `_draftId` vaut `widget.draftId ?? Ids.newId()` : ouvert depuis un bouton,
  /// l'écran tire un identifiant NEUF à chaque montage et relit sous cet
  /// identifiant, qui par construction n'a jamais rien porté. La restauration
  /// était donc en écriture seule : le brouillon existait bien en base, et
  /// personne ne savait plus sous quel nom le chercher.
  ///
  /// On interroge donc, dans l'ordre : l'identifiant de l'URL s'il y en a un,
  /// puis : à défaut : le dernier brouillon connu de ce formulaire. Et en
  /// modification, le brouillon de CETTE fiche, retrouvé par son `entityId`.
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
      // La fiche est chargée ; s'il existe une correction inachevée sur CETTE
      // fiche, elle est plus récente que la base et prime : c'est ce que
      // l'utilisateur était en train d'écrire quand le système l'a interrompu.
      final DraftSnapshot? pending = await drafts.forEntity(
        formKey,
        widget.representantId!,
      );
      if (pending != null && mounted) _offer(pending);
      return;
    }

    DraftSnapshot? snapshot = await drafts.read(_draftId);
    // Aucun brouillon sous l'identifiant courant, et l'URL n'en imposait pas :
    // l'écran vient d'être ouvert depuis un bouton. Le dernier brouillon de ce
    // formulaire est alors la seule piste, et c'est la bonne.
    if (snapshot == null && widget.draftId == null) {
      snapshot = await drafts.latestFor(formKey);
    }
    if (snapshot == null || !mounted) return;
    _offer(snapshot);
  }

  void _offer(DraftSnapshot snapshot) {
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
    // ADOPTION de l'identifiant retrouvé : les écritures suivantes reprennent
    // la même ligne. Sans elle, la reprise créerait un second brouillon et
    // laisserait le premier traîner sept jours.
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
      final String message = _humanize(e);
      setState(() {
        _saving = false;
        _error = message;
      });
      _announceFailure(message);
    }
  }

  /// Un échec d'enregistrement doit être **perçu**, pas seulement affiché.
  ///
  /// Deux canaux, parce qu'aucun ne suffit seul : une infobulle qui passe par
  /// dessus le clavier, et une annonce au lecteur d'écran. Le message rendu en
  /// bas de la liste défilante ne franchissait ni l'un ni l'autre : l'appui
  /// paraissait sans effet.
  void _announceFailure(String message) {
    // `sendAnnouncement` et non `announce` : cette dernière est dépréciée depuis
    // Flutter 3.35 et ne sait pas de quelle fenêtre elle parle.
    // `Assertiveness.assertive` : un échec d'enregistrement interrompt la
    // lecture en cours, il ne se met pas dans la file d'attente.
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

  /// ═══ ON RECONNAÎT LA COLONNE, PAS LE NOM DE L'INDEX ═══
  ///
  /// Le test portait sur `representants_phone_unique`, le nom de l'index.
  /// SQLite ne le cite jamais : il rend « UNIQUE constraint failed:
  /// representants.phone_e164 ». La branche lisible n'était donc JAMAIS prise,
  /// et pour le cas d'échec le plus fréquent de l'application : ressaisir un
  /// représentant déjà enregistré : le commercial recevait un
  /// `SqliteException(2067)` complet en pleine barre d'enregistrement.
  ///
  /// Les deux formes sont acceptées : le nom de l'index couvre les moteurs qui
  /// le citent, la colonne couvre celui qu'on embarque.
  static String _humanize(Object error) {
    final String raw = error.toString();
    if (raw.contains('representants.phone_e164') ||
        raw.contains('representants_phone_unique')) {
      return 'Ce numéro est déjà enregistré sur cet appareil.';
    }
    return 'Enregistrement impossible. $raw';
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final List<Departement> departements =
        ref.watch(departementsProvider).value ?? const <Departement>[];
    // Restreintes au département choisi : proposer les 59 IEF du pays alors que
    // le département est connu ferait chercher dans cinquante-huit entrées hors
    // sujet.
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
          // Hors coque de navigation, cet écran n'avait AUCUN signal réseau :
          // ni cette icône, ni le bandeau d'attente du shell. Or c'est ici que
          // le commercial passe l'essentiel de son temps.
          actions: const <Widget>[
            OfflineIndicator(),
            SizedBox(width: CpiSpacing.xs),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: <Widget>[
              // Sans département, « Enregistrer » ne peut PAS s'activer : c'est
              // la seule chose à dire, et il faut la dire avant que
              // l'utilisateur ne conclue que l'application est cassée.
              ReferentialsBanner(missing: departements.isEmpty),
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
                        setState(() {
                          _departementId = option.id;
                          // Changer de département invalide l'IEF : les IEF
                          // n'appartiennent qu'à un seul département, et garder
                          // « Almadies » après être passé à Thiès produirait une
                          // fiche que le serveur refuserait sans qu'on sache
                          // pourquoi.
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
                // L'erreur voyage AVEC le bouton. En bas d'une `ListView`, elle
                // n'était visible que si l'utilisateur se trouvait déjà au bas
                // du formulaire : dans tous les autres cas, l'appui semblait
                // n'avoir aucun effet.
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

/// Bandeau « ce représentant existe déjà ».
///
/// Il ne bloque pas la saisie : le commercial peut avoir une raison de créer
/// quand même (homonyme, numéro recyclé). Il propose l'action utile : aller
/// ajouter des prospects à la fiche existante : au lieu de se contenter d'un
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
      // Même mise en page que le bandeau des référentiels, et pour la même
      // raison : deux `TextButton` posés dans le `Row` du message réclamaient
      // ensemble plus que la largeur d'un 320 dp. Ils prenaient leur dû AVANT
      // l'`Expanded`, qui se repliait alors sur des dizaines de lignes. Les
      // actions descendent donc sous le message, dans un `Wrap` qui les met
      // l'une sous l'autre plutôt que de sortir de l'écran.
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

/// Barre d'action ancrée en bas.
///
/// En bas et pleine largeur : l'app se tient souvent d'une main ; une action
/// posée en haut d'un écran de 6,5 pouces est hors d'atteinte du pouce.
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

  /// Message d'échec, affiché **au contact du bouton** qui vient d'être appuyé.
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
