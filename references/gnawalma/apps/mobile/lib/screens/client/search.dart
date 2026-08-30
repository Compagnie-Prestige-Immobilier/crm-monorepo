import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart' hide FThemeBuildContext;
import 'package:go_router/go_router.dart';

import '../../models.dart';
import '../../queries.dart';
import '../../session.dart';
import '../../ui.dart';
import 'home.dart';

typedef SearchKey = ({String q, String? region, String? spec});

Pages<Atelier> searchProvider(WidgetRef ref, SearchKey k) {
  final g = geo(ref);
  return Pages(ref, ['ateliers', uid(ref), k.q, k.region, k.spec, g], (api, page) => api.get('/ateliers', query: {
    ...g, if (k.q.isNotEmpty) 'q': k.q, if (k.region != null) 'region': k.region, if (k.spec != null) 'specialite': k.spec, 'page': page, 'limit': 20,
  }), Atelier.fromJson);
}

Res<List<String>> completionsProvider(WidgetRef ref, String q) =>
    Res(ref, ['completions', q], (api) => api.get('/ateliers/completions', query: {'q': q}), (j) => (j['data'] as List).cast<String>());

/// Repli de recherche : la région ou la spécialité visée si l'une est connue, sinon la liste générale.
Res<List<Atelier>> otherAteliersProvider(WidgetRef ref, {String? region, String? spec}) =>
    Res.page(ref, ['ateliers-repli', uid(ref), region, spec], (api) => api.get('/ateliers', query: {
      'region': ?region, 'specialite': ?spec, 'limit': 8,
    }), Atelier.fromJson);

const _browseSpecs = [('homme', 'Homme', FIcons.shirt), ('femme', 'Femme', FIcons.flower), ('enfant', 'Enfant', FIcons.baby)];

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key, this.query, this.specialty, this.region});
  final String? query, specialty, region;
  @override
  ConsumerState<SearchScreen> createState() => _SearchState();
}

class _SearchState extends ConsumerState<SearchScreen> {
  late final _ctrl = TextEditingController(text: widget.query);
  final _focus = FocusNode();
  Timer? _debounce;
  late String _q = widget.query?.trim() ?? '';
  late String? _spec = widget.specialty;
  late String? _region = widget.region;
  bool _focused = false;

  bool get _searched => _q.isNotEmpty || _spec != null || _region != null;

  @override
  void initState() {
    super.initState();
    _ctrl.addListener(_scheduleCommit);
    _focus.addListener(() => setState(() => _focused = _focus.hasFocus));
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _scheduleCommit() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => setState(() => _q = _ctrl.text.trim()));
  }

  void _commit(String v) {
    _debounce?.cancel();
    setState(() => _q = v.trim());
    _focus.unfocus();
  }

  void _pick(String value) {
    _ctrl.text = value;
    _ctrl.selection = TextSelection.collapsed(offset: value.length);
    _commit(value);
  }

  Future<void> _remember(List<Atelier> results) async {
    if (_q.length >= 2 && results.isNotEmpty) await ref.read(searchHistoryProvider.notifier).add(_q);
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(locationProvider);
    final results = _searched ? searchProvider(ref, (q: _q, region: _region, spec: _spec)) : null;
    final typed = _ctrl.text.trim();
    // Une lettre isolée ne complète rien, et la complétion serveur borne la requête à 40 caractères.
    final prefix = typed.length > 40 ? typed.substring(0, 40) : typed;
    return AppScaffold(body: Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.xs, Insets.page, Insets.md), child: _field(context)),
      if (_spec != null || _region != null) Padding(
        padding: const EdgeInsets.fromLTRB(Insets.page, 0, Insets.page, Insets.md),
        child: Wrap(spacing: Insets.sm, children: [
          if (_spec != null) _removable(context, specialties[_spec] ?? _spec!, () => setState(() => _spec = null)),
          if (_region != null) _removable(context, _region!, () => setState(() => _region = null)),
        ]),
      ),
      Expanded(child: Stack(children: [
        () {
          final top = _focused && prefix.length >= 2 ? _completions(context, prefix) : null;
          if (results != null) return _results(context, results, top: top);
          return top == null ? _browse(context) : ListView(padding: EdgeInsets.zero, children: [top]);
        }(),
        // Posée au-dessus de la barre d'onglets, qui déborde sur le corps de l'écran.
        if (results != null) Positioned(bottom: Insets.xxxl * 2 + MediaQuery.viewPaddingOf(context).bottom, left: 0, right: 0, child: Center(
          child: AppButton('Carte', icon: FIcons.map, size: 48, onPressed: () => context.push('/client/carte')),
        )),
      ])),
    ]));
  }

  Widget _field(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(color: context.colors.surface, borderRadius: Radii.full, boxShadow: AppShadow.card),
    child: Padding(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.xs, Insets.md, Insets.xs), child: Row(children: [
      Icon(FIcons.search, size: 20, color: context.colors.onSurface), const SizedBox(width: Insets.md),
      Expanded(child: Semantics(label: 'Rechercher un atelier', textField: true, child: FTextField(
        control: FTextFieldControl.managed(controller: _ctrl), focusNode: _focus,
        hint: 'Rechercher un atelier', textInputAction: TextInputAction.search, onSubmit: _commit,
        style: FTextFieldStyleDelta.delta(
          color: FVariantsValueDelta.delta([FVariantValueDeltaOperation.all(Colors.transparent)]),
          border: FVariantsValueDelta.delta([FVariantValueDeltaOperation.all(InputBorder.none)]),
        ),
        suffixBuilder: (_, _, _) => _ctrl.text.isEmpty ? const SizedBox.shrink() : FTappable(
          onPress: () => setState(() { _ctrl.clear(); _q = ''; }), semanticsLabel: 'Effacer la recherche',
          child: SizedBox.square(dimension: 48, child: Icon(FIcons.x, size: 18, color: context.tones.inkSecondary)),
        ),
      ))),
    ])),
  );

  Widget _removable(BuildContext context, String label, VoidCallback onRemove) => FTappable(
    onPress: onRemove, semanticsLabel: '$label, retirer',
    child: ExcludeSemantics(child: DecoratedBox(
      decoration: BoxDecoration(color: context.tones.sunken, borderRadius: Radii.full),
      child: ConstrainedBox(constraints: const BoxConstraints(minHeight: 48), child: Padding(padding: const EdgeInsets.symmetric(horizontal: Insets.md), child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(label, style: context.text.labelLarge), const SizedBox(width: Insets.xs),
        Icon(FIcons.x, size: 14, color: context.tones.inkSecondary),
      ]))),
    )),
  );

  Widget _chip(BuildContext context, String label, VoidCallback onTap, {IconData? icon, VoidCallback? onRemove}) => FTappable(
    onPress: onTap, onLongPress: onRemove, semanticsLabel: label,
    child: DecoratedBox(
      decoration: BoxDecoration(color: context.colors.surface, borderRadius: Radii.full, boxShadow: AppShadow.card),
      child: ConstrainedBox(constraints: const BoxConstraints(minHeight: 48), child: Padding(padding: EdgeInsets.only(left: Insets.md, right: onRemove == null ? Insets.md : 0), child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 16, color: context.colors.onSurface), const SizedBox(width: Insets.xs)],
        ExcludeSemantics(child: Text(label, style: context.text.labelLarge)),
        if (onRemove != null) FTappable(
          onPress: onRemove, semanticsLabel: 'Retirer $label',
          child: SizedBox.square(dimension: 48, child: Icon(FIcons.x, size: 14, color: context.tones.inkSecondary)),
        ),
      ]))),
    ),
  );

  Widget _groupLabel(BuildContext context, String text) =>
      Padding(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.xl, Insets.page, Insets.md), child: Text(text, style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary)));

  Widget _completions(BuildContext context, String q) => completionsProvider(ref, q).watch((list, error) {
    final items = list ?? const <String>[];
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(children: [
      for (final (i, s) in items.take(4).indexed) ...[
        if (i > 0) const AppDivider(),
        AppRow(title: s, leading: const Icon(FIcons.search), onTap: () => _pick(s)),
      ],
    ]);
  });

  Widget _browse(BuildContext context) {
    final history = ref.watch(searchHistoryProvider).value ?? const <String>[];
    return ListView(padding: const EdgeInsets.only(bottom: Insets.xxxl), children: [
      if (history.isNotEmpty) ...[
        Row(children: [
          Expanded(child: _groupLabel(context, 'Recherches récentes')),
          Padding(padding: const EdgeInsets.only(right: Insets.page), child: AppButton('Effacer', variant: AppButtonVariant.ghost, size: 48, onPressed: () => ref.read(searchHistoryProvider.notifier).clear())),
        ]),
        Padding(padding: const EdgeInsets.symmetric(horizontal: Insets.page), child: Wrap(spacing: Insets.sm, runSpacing: Insets.sm, children: [
          for (final h in history) _chip(context, h, () => _pick(h), onRemove: () => ref.read(searchHistoryProvider.notifier).remove(h)),
        ])),
      ],
      _refine(context, 'Parcourir'),
      _near(context),
    ]);
  }

  /// Spécialités et régions : visibles avant la recherche comme après, pour affiner sans revenir en arrière.
  Widget _refine(BuildContext context, String label) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    _groupLabel(context, label),
    Padding(padding: const EdgeInsets.symmetric(horizontal: Insets.page), child: Wrap(spacing: Insets.sm, runSpacing: Insets.sm, children: [
      for (final (key, l, icon) in _browseSpecs) _chip(context, l, () => setState(() { _spec = key; _region = null; }), icon: icon),
    ])),
    const SizedBox(height: Insets.sm),
    SingleChildScrollView(
      scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: Insets.page),
      child: Row(spacing: Insets.sm, children: [for (final r in regions) _chip(context, r, () => setState(() { _region = r; _spec = null; }))]),
    ),
  ]);

  Widget _near(BuildContext context) {
    if (ref.watch(locationServiceProvider).value == true && !ref.watch(locationProvider).isLoading) {
      final near = nearbyProvider(ref);
      if (near != null) {
        return near.watch((list, _) => list == null || list.isEmpty ? const SizedBox.shrink() : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          sectionHeader(context, 'Près de chez vous', () => context.push('/client/carte')), strip(context, list),
        ]));
      }
    }
    return verifiedProvider(ref).watch((list, _) {
      final verified = list?.where((a) => a.verified).toList() ?? const <Atelier>[];
      if (verified.isEmpty) return const SizedBox.shrink();
      // Pas de chevron : l'API n'expose pas de filtre « vérifiés », la recherche les remonte déjà en premier.
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_groupLabel(context, 'Ateliers vérifiés'), strip(context, verified, hero: false)]);
    });
  }

  Widget _results(BuildContext context, Pages<Atelier> results, {Widget? top}) => PagedList(results,
    header: (loaded) => Column(children: [?top, _refine(context, 'Affiner'), _headline(context, loaded, results)]),
    frame: (loaded, list) => _frame(context, loaded, results, list, top: top),
    skeleton: const AppSkeleton(rows: 3, height: 220), padding: const EdgeInsets.only(bottom: Insets.xxxl),
    // Jamais un écran vide : le repli prend la place des résultats absents.
    empty: ListView(padding: EdgeInsets.zero, children: [
      Padding(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.xxl, Insets.page, 0),
        child: Text(_suffix == null ? 'Rien pour le moment' : 'Rien $_suffix pour le moment', style: context.text.titleLarge)),
      _others(context),
      const SizedBox(height: Insets.xxl),
    ]),
    item: (a) => Padding(padding: const EdgeInsets.symmetric(horizontal: Insets.page, vertical: Insets.lg), child: AtelierCard(a)),
  );

  String? get _suffix => _q.isNotEmpty ? 'pour « $_q »' : _spec != null ? '· ${specialties[_spec] ?? _spec}' : _region != null ? '· $_region' : null;

  String _headlineText(int n, bool more) {
    final s = _suffix;
    return '$n${more ? '+' : ''} atelier${n > 1 ? 's' : ''}${s == null ? '' : ' $s'}';
  }

  String? _rememberedFor;
  Widget _headline(BuildContext context, List<Atelier> loaded, Pages<Atelier> results) {
    if (loaded.isEmpty) return const SizedBox.shrink();
    if (_q.isNotEmpty && _rememberedFor != _q) {
      _rememberedFor = _q;
      WidgetsBinding.instance.addPostFrameCallback((_) => _remember(loaded));
    }
    return Padding(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.md, Insets.page, 0), child: Text(_headlineText(loaded.length, results.query.hasNextPage()), style: context.text.titleMedium));
  }

  /// Une fois la pagination terminée, moins de 3 résultats appelle le repli dans la même liste.
  Widget _frame(BuildContext context, List<Atelier> loaded, Pages<Atelier> results, Widget list, {Widget? top}) {
    if (results.query.hasNextPage() || loaded.isEmpty || loaded.length >= 3) return list;
    return ListView(padding: const EdgeInsets.only(bottom: Insets.xxxl), children: [
      ?top,
      _refine(context, 'Affiner'),
      Padding(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.md, Insets.page, 0), child: Text(_headlineText(loaded.length, false), style: context.text.titleMedium)),
      for (final a in loaded) Padding(padding: const EdgeInsets.symmetric(horizontal: Insets.page, vertical: Insets.lg), child: AtelierCard(a)),
      _others(context, fromResults: loaded.first.region, exclude: loaded.map((a) => a.id).toSet()),
    ]);
  }

  Widget _others(BuildContext context, {String? fromResults, Set<int> exclude = const {}}) {
    final region = _regionFallback(fromResults);
    return otherAteliersProvider(ref, region: region, spec: _spec).watch((list, _) {
      // Sans région ni spécialité, le repli se limite aux ateliers vérifiés.
      final loose = region == null && _spec == null;
      final picks = (list ?? const <Atelier>[]).where((a) => !exclude.contains(a.id) && (!loose || a.verified)).take(5).toList();
      if (picks.isEmpty) return const SizedBox.shrink();
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_groupLabel(context, 'Autres ateliers'), strip(context, picks, hero: false)]);
    });
  }

  String? _regionFallback(String? fromResults) {
    if (_region != null) return _region;
    if (fromResults != null) return fromResults;
    final history = ref.read(searchHistoryProvider).value ?? const [];
    for (final h in history) {
      for (final r in regions) {
        if (foldAccents(r) == foldAccents(h)) return r;
      }
    }
    return ref.read(userProvider)?.atelier?.region;
  }
}
