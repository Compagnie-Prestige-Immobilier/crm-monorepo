import 'dart:convert';

import 'package:cached_query_flutter/cached_query_flutter.dart' hide AppState;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart' show FCircularProgress;
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';

import 'api.dart';
import 'session.dart';
import 'ui.dart';

export 'package:cached_query_flutter/cached_query_flutter.dart' show CachedQuery, CachedQueryExt;
export 'package:cached_storage/cached_storage.dart' show CachedStorage;

typedef Json = Map<String, dynamic>;

/// 30 s de fraîcheur avant refetch en arrière-plan, 1 h en mémoire sans écran, 30 jours sur disque.
const queryConfig = GlobalQueryConfig(storeQuery: true, staleDuration: Duration(seconds: 30), cacheDuration: Duration(hours: 1), storageDuration: Duration(days: 30));

int? uid(WidgetRef ref) => ref.read(userProvider)?.id;

/// Marque périmées les lectures dont la clé commence par un des préfixes ; les listes paginées repartent de la page 1.
void invalidate(Set<String> prefixes) {
  for (final q in CachedQuery.instance.whereQuery((q) => q.unencodedKey is List && prefixes.contains((q.unencodedKey as List).first)).toList()) {
    if (q case InfiniteQuery<dynamic, int>(state: InfiniteQueryStatus(:final data?)) when data.pages.length > 1) q.setData(InfiniteQueryData(pages: [data.pages.first], args: [1]));
    q.invalidate();
  }
}

void clearCache() => CachedQuery.instance.deleteCache(deleteStorage: true);

/// Une lecture serveur : le JSON brut est mis en cache (mémoire et disque), décodé à l'affichage.
class Res<T> {
  Res(WidgetRef ref, Object key, Future<dynamic> Function(Api api) fetch, this.decode) : query = _query(ref, key, fetch);
  static Res<T> one<T>(WidgetRef ref, Object key, Future<dynamic> Function(Api api) fetch, T Function(Json j) f) => Res(ref, key, fetch, (j) => f(j));
  static Res<List<T>> list<T>(WidgetRef ref, Object key, Future<dynamic> Function(Api api) fetch, T Function(Json j) f) => Res(ref, key, fetch, (j) => (j as List).cast<Json>().map(f).toList());
  static Res<List<T>> page<T>(WidgetRef ref, Object key, Future<dynamic> Function(Api api) fetch, T Function(Json j) f) => Res(ref, key, fetch, (j) => (j['data'] as List).cast<Json>().map(f).toList());

  final Query<dynamic> query;
  final T Function(dynamic json) decode;

  Future<void> refetch() => query.refetch();
  Widget watch(Widget Function(T? data, Object? error) builder) =>
      QueryBuilder<QueryStatus<dynamic>>(query: query, builder: (_, s) => builder(s.data == null ? null : decode(s.data), s.error));
}

Query<dynamic> _query(WidgetRef ref, Object key, Future<dynamic> Function(Api api) fetch) {
  final api = ref.read(apiProvider);
  return Query<dynamic>(key: key, queryFn: () => fetch(api));
}

/// Une liste Laravel simplePaginate : pages brutes en cache, `?page=N` tant que `next_page_url` existe.
class Pages<T> {
  Pages(WidgetRef ref, Object key, Future<dynamic> Function(Api api, int page) fetch, this.decode) : query = _pages(ref, key, fetch);

  final InfiniteQuery<dynamic, int> query;
  final T Function(Json j) decode;

  List<T> items(InfiniteQueryData<dynamic, int>? d) => [for (final p in d?.pages ?? const []) ...(p['data'] as List).cast<Json>().map(decode)];
  Future<void> refetch() => query.refetch();
  Widget watch(Widget Function(List<T>? items) builder) =>
      QueryBuilder<InfiniteQueryStatus<dynamic, int>>(query: query, builder: (_, s) => builder(s.data == null ? null : items(s.data)));
}

InfiniteQuery<dynamic, int> _pages(WidgetRef ref, Object key, Future<dynamic> Function(Api api, int page) fetch) {
  final api = ref.read(apiProvider);
  return InfiniteQuery<dynamic, int>(key: key, queryFn: (page) => fetch(api, page), getNextArg: _nextPage, onPageRefetched: _refetched, config: _pagesConfig);
}

const _pagesConfig = QueryConfig<InfiniteQueryData<dynamic, int>>(storageDeserializer: _decodePages);
InfiniteQueryData<dynamic, int> _decodePages(dynamic j) => InfiniteQueryData.fromJson(j, pagesConverter: (p) => p, argsConverter: (a) => a.cast<int>());
int? _nextPage(InfiniteQueryData<dynamic, int>? d) => d == null || d.pages.isEmpty ? 1 : d.lastPage['next_page_url'] == null ? null : d.args.last + 1;

// Au refetch, seule la page 1 est relue : inchangée, on garde toutes les pages ; sinon la liste repart de là.
InfiniteQueryData<dynamic, int>? _refetched(dynamic page, InfiniteQueryData<dynamic, int> result, InfiniteQueryData<dynamic, int> cached) =>
    jsonEncode(page) == jsonEncode(cached.firstPage) ? cached : result;

/// Squelette, erreur avec réessai, puis données. Avec [page], squelette et erreur sont posés dans un AppScaffold.
class Remote<T> extends StatelessWidget {
  const Remote(this.res, {super.key, required this.builder, this.skeleton = const AppSkeleton(), this.page = false});
  final Res<T> res;
  final Widget Function(T data) builder;
  final Widget skeleton;
  final bool page;

  @override
  Widget build(BuildContext context) => res.watch((data, error) {
    if (data != null) return builder(data);
    final fallback = error == null ? skeleton : AppState.fromError(error, onRetry: res.refetch);
    return page ? AppScaffold(body: fallback) : fallback;
  });
}

/// Liste infinie séparée par des AppDivider. [header] défile avec la liste, [frame] habille le tout selon ce qui est chargé.
/// Avec [card], toutes les lignes tiennent dans une seule carte blanche posée dans la gouttière.
class PagedList<T> extends StatelessWidget {
  const PagedList(this.pages, {super.key, required this.item, required this.empty, this.filter, this.group, this.groupAction, this.header, this.frame, this.padding, this.skeleton = const AppSkeleton(), this.card = false});
  final Pages<T> pages;
  final Widget Function(T item) item;
  final Widget empty, skeleton;
  final bool Function(T item)? filter;
  final String Function(T item)? group;
  final Widget Function(String key, List<T> items)? groupAction;
  final Widget? Function(List<T> loaded)? header;
  final Widget Function(List<T> loaded, Widget list)? frame;
  final EdgeInsets? padding;
  final bool card;

  @override
  Widget build(BuildContext context) => QueryBuilder<InfiniteQueryStatus<dynamic, int>>(
    query: pages.query,
    builder: (_, s) {
      final loaded = s.data == null ? null : pages.items(s.data), f = filter;
      final items = f == null ? loaded : loaded?.where(f).toList();
      final more = pages.query.hasNextPage();
      final head = loaded == null ? null : header?.call(loaded), fr = frame;
      final Widget body;
      if (items == null) {
        body = s.error == null ? skeleton : AppState.fromError(s.error, onRetry: pages.refetch);
      } else if (items.isEmpty) {
        body = empty;
      } else {
        final g = group;
        Widget list;
        var pad = padding ?? EdgeInsets.zero;
        if (g != null) {
          final groups = <String, List<T>>{};
          for (final it in items) { groups.putIfAbsent(g(it), () => []).add(it); }
          list = SliverList.list(children: [
            for (final e in groups.entries) Padding(padding: const EdgeInsets.only(bottom: Insets.lg), child: AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.lg, Insets.page, 0), child: Row(children: [
                Expanded(child: Text(e.key, style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary))),
                ?groupAction?.call(e.key, e.value),
              ])),
              for (final (i, it) in e.value.indexed) ...[if (i > 0) const AppDivider(), item(it)],
              const SizedBox(height: Insets.sm),
            ]))),
            if (more) _Footer(retry: s.error == null ? null : pages.query.getNextPage, load: s.error == null && !s.isLoading ? pages.query.getNextPage : null),
          ]);
        } else {
          list = PagedSliverList<int, T>.separated(
            state: PagingState(pages: [items], keys: const [1], error: s.error, hasNextPage: more, isLoading: s.isLoading),
            fetchNextPage: pages.query.getNextPage,
            separatorBuilder: (_, _) => const AppDivider(),
            builderDelegate: PagedChildBuilderDelegate<T>(
              itemBuilder: (_, it, _) => item(it),
              newPageProgressIndicatorBuilder: (_) => const _Footer(),
              newPageErrorIndicatorBuilder: (_) => _Footer(retry: pages.query.getNextPage),
            ),
          );
          if (card) {
            final dark = context.theme.brightness == Brightness.dark;
            list = DecoratedSliver(decoration: BoxDecoration(color: context.colors.surface, borderRadius: Radii.card, boxShadow: dark ? null : AppShadow.card), sliver: list);
          }
        }
        if (card || g != null) pad = pad.copyWith(left: pad.left + Insets.page, right: pad.right + Insets.page);
        body = CustomScrollView(physics: const AlwaysScrollableScrollPhysics(), slivers: [
          if (head != null) SliverToBoxAdapter(child: head),
          SliverPadding(padding: pad, sliver: list),
        ]);
      }
      return fr == null ? body : fr(loaded ?? <T>[], body);
    },
  );
}

// Monté seulement quand il entre dans la zone visible : c'est ce qui déclenche la page suivante en mode groupé.
class _Footer extends StatefulWidget {
  const _Footer({this.retry, this.load});
  final VoidCallback? retry, load;
  @override
  State<_Footer> createState() => _FooterState();
}

class _FooterState extends State<_Footer> {
  @override
  void initState() {
    super.initState();
    if (widget.load != null) WidgetsBinding.instance.addPostFrameCallback((_) => widget.load!());
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(Insets.lg),
    child: Center(child: widget.retry == null ? const FCircularProgress() : AppButton('Réessayer', variant: AppButtonVariant.ghost, size: 44, onPressed: widget.retry)),
  );
}
