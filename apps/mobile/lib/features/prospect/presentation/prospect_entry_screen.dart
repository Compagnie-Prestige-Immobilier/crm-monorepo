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

/// Saisie de prospects : l'écran le plus utilisé de l'app.
///
/// ## Ce que « rapide » veut dire ici
///
/// Un téléconseiller saisit une liste de dix à quarante personnes d'affilée,
/// pendant qu'un délégué syndical lui dicte des noms. Les trois quarts de ces
/// personnes partagent la même banque et le même syndicat.
///
/// D'où **« Enregistrer et suivant »** : représentant, banque et syndicat restent
/// pré-remplis d'un prospect au suivant, le focus revient sur « Nom », et il ne
/// reste que trois champs à taper. Repartir d'un formulaire vierge à chaque fois
/// multiplierait par deux le nombre de gestes, et surtout obligerait à
/// re-sélectionner deux listes déroulantes : le geste le plus lent d'un
/// formulaire tactile.
///
/// Le **compteur** et le **retour haptique** ne sont pas décoratifs : sans
/// confirmation perceptible, l'utilisateur regarde l'écran après chaque
/// enregistrement pour vérifier qu'il est parti, et c'est ce coup d'œil qui
/// casse le rythme de la dictée.
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

  /// Non `final` : l'écran ADOPTE l'identifiant d'un brouillon retrouvé, au lieu
  /// d'en ouvrir un second et de laisser le premier orphelin.
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

  /// Vide veut dire « rien à sauver », et **choisir une banque et un syndicat
  /// n'est pas rien** : ce sont les deux gestes les plus coûteux de l'écran, ceux
  /// que « Enregistrer et suivant » conserve exprès d'un prospect au suivant. Ne
  /// tester que les trois champs texte faisait jeter en silence exactement la
  /// partie du formulaire qu'on cherche à protéger.
  @override
  bool get draftIsEmpty =>
      _nom.text.trim().isEmpty &&
      _prenom.text.trim().isEmpty &&
      _phone.text.trim().isEmpty &&
      _banqueId == null &&
      _syndicatId == null;

  /// Le représentant parent voyage déjà dans `?rep=` ; on lui adjoint la
  /// référence au brouillon, sans quoi un redémarrage rouvre bien le bon parent
  /// mais avec un formulaire vide.
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

  /// Retrouve la saisie inachevée, quel que soit le chemin d'arrivée.
  ///
  /// `_draftId` vaut `widget.draftId ?? Ids.newId()` : ouvert depuis le
  /// sélecteur de représentant, l'écran tirait un identifiant NEUF et relisait
  /// sous cet identifiant, qui n'avait par construction jamais rien porté. La
  /// restauration était en écriture seule. On retombe donc sur le dernier
  /// brouillon connu de ce formulaire quand l'URL n'en impose aucun.
  Future<void> _restore() async {
    final DraftRepository drafts = ref.read(draftRepositoryProvider);
    DraftSnapshot? snapshot = await drafts.read(_draftId);
    if (snapshot == null && widget.draftId == null) {
      final DraftSnapshot? latest = await drafts.latestFor(formKey);
      // **Le parent doit correspondre.** Un brouillon saisi pour un autre
      // représentant remonté ici rattacherait ses prospects à la mauvaise
      // fiche : c'est-à-dire, au bout de la chaîne, à la mauvaise commission.
      if (latest != null && _acceptsParent(latest)) snapshot = latest;
    }
    if (snapshot != null && mounted) _offer(snapshot);
    await _loadRepresentant();
  }

  /// Le brouillon vise-t-il le représentant courant ?
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
      // Doublon **local uniquement** : ici la vitesse prime, et le serveur
      // tranchera de toute façon sur son index unique. Une requête réseau par
      // prospect ralentirait la dictée sans rien apporter que le 409 ne dise
      // déjà.
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

      discardDraft();
      // Retour haptique : la confirmation que l'utilisateur perçoit sans
      // regarder l'écran. C'est ce qui lui permet de garder les yeux sur la
      // liste qu'on lui dicte.
      await HapticFeedback.mediumImpact();
      ref.read(syncCoordinatorProvider.notifier).nudge();

      if (!mounted) return;
      if (andNext) {
        setState(() {
          // On vide UNIQUEMENT les trois champs propres à la personne.
          // Représentant, banque et syndicat restent : ce sont eux qui coûtent
          // le plus cher à re-sélectionner.
          _nom.clear();
          _prenom.clear();
          _phone.clear();
          _duplicateName = null;
          _saving = false;
        });
        _nomFocus.requestFocus();
      } else {
        // Retour à l'écran d'où l'on vient plutôt qu'un saut d'onglet : la
        // saisie de prospects s'ouvre depuis l'historique comme depuis un
        // formulaire de représentant.
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

  /// ═══ ON RECONNAÎT LA COLONNE, PAS LE NOM DE L'INDEX ═══
  ///
  /// Le test portait sur `prospects_phone_unique`, le nom de l'index. SQLite ne
  /// le cite jamais : il rend « UNIQUE constraint failed:
  /// prospects.phone_e164 ». La phrase lisible était donc morte, et un prospect
  /// dicté deux fois : ce qui arrive plusieurs fois par liste : renvoyait un
  /// `SqliteException(2067)` brut au milieu de la dictée.
  static String _humanize(Object error) {
    final String raw = error.toString();
    if (raw.contains('prospects.phone_e164') || raw.contains('prospects_phone_unique')) {
      return 'Ce numéro est déjà enregistré sur cet appareil.';
    }
    return 'Enregistrement impossible. $raw';
  }

  /// Un échec d'enregistrement doit être **perçu**, pas seulement affiché.
  ///
  /// Pendant une dictée de quarante prospects, les yeux sont sur la liste et pas
  /// sur l'écran. Le message rendu tout en bas d'une `ListView` défilante ne
  /// franchissait ni le regard ni le lecteur d'écran : l'appui paraissait sans
  /// effet, et le commercial passait au suivant en croyant avoir enregistré.
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
          // Une dictée de quarante prospects se fait entièrement sur cet écran,
          // hors coque de navigation : sans cette icône, le commercial n'avait
          // aucun signal réseau pendant tout ce temps.
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
        // ═══ UN SEUL ÉLÉMENT NON DÉFILANT : LA BARRE D'ENREGISTREMENT ═══
        //
        // Les deux bandeaux étaient des enfants NON flexibles de cette colonne,
        // au même titre que la barre. Au plafond réellement atteignable
        // (Android à 1,3 × « Très grand » à 1,35, soit 1,755), le bandeau des
        // référentiels réclamait à lui seul 367 px sur un 320 dp : avec les
        // 302 px de la barre, la colonne débordait de son écran avant même
        // d'avoir posé un champ.
        //
        // Tout ce qui n'est pas la barre entre donc dans le défilement. La
        // barre reste épinglée, parce que c'est elle qui porte le message
        // d'échec : le rendre défilant est précisément le défaut qu'on a
        // corrigé ailleurs.
        body: SafeArea(
          child: Column(
            children: <Widget>[
              Expanded(
                child: CustomScrollView(
                  slivers: <Widget>[
                    // Sans banque NI syndicat, « Enregistrer » ne peut pas
                    // s'activer.
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
                            await ref.read(draftRepositoryProvider).delete(_draftId);
                            if (mounted) setState(() => _pendingRestore = null);
                          },
                        ),
                      ),
                    if (_representantId == null)
                      // `SliverFillRemaining` et non un simple bloc : l'état
                      // vide reste centré tant qu'il y a de la place, et se met
                      // à défiler quand il n'y en a plus, au lieu de déborder.
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
                      // L'échec voyage AVEC les boutons. Rendu en bas d'une
                      // liste défilante, il n'était visible que si l'on s'y
                      // trouvait déjà : ailleurs, l'appui semblait sans effet.
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

/// Le bandeau de contexte sous le titre : représentant courant et compteur.
///
/// ═══ POURQUOI SA HAUTEUR EST MESURÉE ET NON FIXÉE ═══
///
/// C'était un `PreferredSize(Size.fromHeight(28))`. 28 px, c'est une ligne de
/// `bodySmall` à la taille de texte 1,0 : à « Très grand » (1,8), la même ligne
/// en réclame 39 et la barre débordait de 11 px. Un `PreferredSize` ne
/// s'adapte pas tout seul : sa hauteur est une constante que `Scaffold` réserve
/// pour la barre entière, et le texte qu'on lui confie, lui, grandit.
///
/// La hauteur est donc MESURÉE par un `TextPainter` réglé exactement comme le
/// `Text` rendu ensuite : même style, même échelle, même largeur utile, même
/// `maxLines`. On la calcule ici, dans le `build` de l'écran, parce que c'est
/// le seul endroit où l'on dispose à la fois du contexte et du texte.
///
/// Deux lignes autorisées : un nom long suivi du compteur ne tient pas sur une
/// seule à 320 dp, et tronquer ferait disparaître le compteur, or c'est lui qui
/// dit au commercial où il en est dans sa dictée.
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
    // `Center` + `MainAxisSize.min` plutôt qu'`Expanded` : cet état vide vit
    // maintenant dans un `SliverFillRemaining`, qui lui donne au moins la
    // hauteur restante et le laisse grandir au-delà. Un `Expanded` y serait une
    // erreur de contrat, et une colonne `max` déborderait dès que le texte
    // grandit plus vite que l'écran.
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
              // Repli sur le SÉLECTEUR de représentants, pas sur l'historique :
              // le bouton dit « Voir mes représentants », et l'historique est
              // une liste de saisies. Le libellé promettait un écran, le repli
              // en ouvrait un autre.
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
      // Les deux actions sous le message, dans un `Wrap` : côte à côte dans le
      // `Row` du message, elles réclamaient leur largeur intrinsèque avant
      // l'`Expanded` et ne laissaient au texte que quelques dizaines de pixels,
      // sur lesquels il se repliait jusqu'à faire déborder l'écran.
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
