import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart' hide FThemeBuildContext;
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api.dart';
import '../../config.dart';
import '../../models.dart';
import '../../queries.dart';
import '../../session.dart';
import '../../ui.dart';
import 'more.dart';

// Dart n'accepte pas de directive après une déclaration : l'export vit ici.
export 'more.dart';
export 'search.dart';

enum LocationOutcome { located, refused, settings }

/// Jamais demandée au démarrage : on lit la permission, on ne la réclame que depuis le bouton.
class LocationNotifier extends AsyncNotifier<Position?> {
  @override
  Future<Position?> build() async {
    if (!await Geolocator.isLocationServiceEnabled()) return null;
    return _granted(await Geolocator.checkPermission()) ? _locate() : null;
  }

  /// Après [LocationOutcome.settings] les réglages système sont au premier plan : l'appelant ne doit rien ouvrir d'autre.
  Future<LocationOutcome> request() async {
    if (!await Geolocator.isLocationServiceEnabled()) { ref.invalidate(locationServiceProvider); return LocationOutcome.refused; }
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    if (p == LocationPermission.deniedForever) { await Geolocator.openAppSettings(); return LocationOutcome.settings; }
    if (!_granted(p)) return LocationOutcome.refused;
    state = AsyncData(await _locate());
    return state.value == null ? LocationOutcome.refused : LocationOutcome.located;
  }

  bool _granted(LocationPermission p) => p == LocationPermission.always || p == LocationPermission.whileInUse;

  Future<Position?> _locate() async {
    try { return await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.low, timeLimit: Duration(seconds: 10))); }
    catch (_) { return Geolocator.getLastKnownPosition(); }
  }
}

final locationProvider = AsyncNotifierProvider<LocationNotifier, Position?>(LocationNotifier.new);
final locationServiceProvider = FutureProvider<bool>((_) => Geolocator.isLocationServiceEnabled());

// Les écrans qui en dépendent observent locationProvider : la clé change avec la position.
Json geo(WidgetRef ref) {
  final p = ref.read(locationProvider).value;
  return p == null ? {} : {'lat': p.latitude, 'lng': p.longitude};
}

Res<List<Promotion>> promotionsProvider(WidgetRef ref) => Res.list(ref, const ['promotions'], (api) => api.get('/promotions'), Promotion.fromJson);
// Les listes portent favoris et can_review : la clé inclut le compte, sinon l'invité et le connecté partagent le cache.
Res<List<Atelier>> verifiedProvider(WidgetRef ref) => Res.page(ref, ['ateliers-verifies', uid(ref)], (api) => api.get('/ateliers', query: {'limit': 10}), Atelier.fromJson);
Res<List<Atelier>>? nearbyProvider(WidgetRef ref) {
  final g = geo(ref);
  if (g.isEmpty) return null;
  return Res.page(ref, ['ateliers-proches', uid(ref), g], (api) => api.get('/ateliers', query: {...g, 'rayon': 30, 'limit': 10}), Atelier.fromJson);
}
Res<Atelier> atelierProvider(WidgetRef ref, int id) {
  final g = geo(ref);
  return Res.one(ref, ['atelier', uid(ref), id, g], (api) => api.get('/ateliers/$id', query: g), Atelier.fromJson);
}
Res<List<Review>> reviewsProvider(WidgetRef ref, int id) => Res.page(ref, ['avis', id], (api) => api.get('/ateliers/$id/avis'), Review.fromJson);

/// Action interrompue par un besoin de compte : rejouée une fois connecté, sur l'écran identifié par [next].
/// L'intention est un mot, pas une fermeture : l'écran qui rejoue peut avoir été reconstruit entre-temps.
class PendingAction {
  const PendingAction(this.next, this.intent);
  final String next, intent;
}

final pendingAction = ValueNotifier<PendingAction?>(null);

String? takePendingIntent(String screen) {
  final pending = pendingAction.value;
  if (pending == null || pending.next != screen) return null;
  pendingAction.value = null;
  return pending.intent;
}

Future<bool> requireAccount(BuildContext context, WidgetRef ref, {required String next, String? intent}) async {
  if (ref.read(userProvider) != null) return true;
  if (intent != null) pendingAction.value = PendingAction(next, intent);
  final n = Uri.encodeQueryComponent(next);
  final chosen = await showAppSheet<bool>(context, title: 'Un compte est nécessaire', child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Text('Un compte vous permet de contacter les ateliers, de garder vos favoris et de laisser un avis.', style: context.text.bodyLarge!.copyWith(color: context.tones.inkSecondary)),
    const SizedBox(height: Insets.xl),
    AppButton('Se connecter', onPressed: () { popSheet(context, true); context.push('/connexion?next=$n'); }),
    const SizedBox(height: Insets.sm),
    AppButton('Créer un compte', variant: AppButtonVariant.secondary, onPressed: () { popSheet(context, true); context.push('/inscription?next=$n'); }),
  ]));
  // Feuille refermée sans aller au compte : l'action ne doit pas resurgir plus tard.
  if (chosen != true) pendingAction.value = null;
  return false;
}

// Une note change la moyenne affichée partout : toutes les listes d'ateliers repartent du serveur.
const reviewStale = {'atelier', 'avis', 'contacts', 'ateliers', 'ateliers-proches', 'ateliers-verifies', 'ateliers-repli', 'carte'};

/// Renvoie l'état final du favori : inchangé si le compte manque ou si l'envoi échoue.
Future<bool> _setFavorite(BuildContext context, WidgetRef ref, Atelier a, bool fav) async {
  if (!await requireAccount(context, ref, next: '/client/ateliers/${a.id}', intent: 'favori')) return !fav;
  try { fav ? await ref.read(apiProvider).post('/mes-favoris/${a.id}') : await ref.read(apiProvider).delete('/mes-favoris/${a.id}'); }
  on ApiException catch (e) { if (context.mounted) toast(context, e.message); return !fav; }
  invalidate({'favoris', 'atelier', 'ateliers', 'ateliers-proches', 'ateliers-verifies', 'ateliers-repli', 'carte'});
  return fav;
}

final _num = NumberFormat('0.0', 'fr');
String _km(double km) => km < 1 ? '${(km * 1000).round()} m' : '${_num.format(km)} km';
String _meta(Atelier a) => [a.region ?? '', a.specialties.map((s) => specialties[s] ?? s).join(', ')].where((s) => s.isNotEmpty).join(' · ');
const _onPhoto = Colors.white; // Posé sur un voile sombre, pas sur une surface : blanc dans les deux thèmes.

/// Cercle blanc posé sur une photo : lisible quel que soit le visuel dessous.
/// L'anneau double la teinte : le favori actif ne se distingue pas que par la couleur.
Widget _bubble(BuildContext context, IconData icon, String label, VoidCallback onTap, {double size = 48, Color? color}) =>
    FTappable(onPress: onTap, semanticsLabel: label, child: Container(
      width: size, height: size, alignment: Alignment.center,
      decoration: BoxDecoration(
        color: context.colors.surface, shape: BoxShape.circle, boxShadow: AppShadow.card,
        border: color == null ? null : Border.all(color: color, width: 1.5),
      ),
      child: Icon(icon, size: 20, color: color ?? context.colors.onSurface),
    ));

/// Pastille de recherche flottante : texte figé sur l'accueil, champ éditable sur la recherche.
const _hint = 'Rechercher un atelier';

Widget searchPill(BuildContext context, {TextEditingController? controller, VoidCallback? onTap, ValueChanged<String>? onSubmitted, bool autofocus = false}) {
  final pill = DecoratedBox(
    decoration: BoxDecoration(color: context.colors.surface, borderRadius: Radii.full, boxShadow: AppShadow.card),
    child: Padding(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.xs, Insets.md, Insets.xs), child: Row(children: [
      Icon(FIcons.search, size: 20, color: context.colors.onSurface), const SizedBox(width: Insets.md),
      Expanded(child: controller == null
          ? Padding(padding: const EdgeInsets.symmetric(vertical: Insets.md), child: Text(_hint, style: context.text.bodyLarge!.copyWith(fontWeight: FontWeight.w600)))
          : FTextField(
              control: FTextFieldControl.managed(controller: controller), hint: _hint, autofocus: autofocus, textInputAction: TextInputAction.search, onSubmit: onSubmitted,
              style: FTextFieldStyleDelta.delta(
                color: FVariantsValueDelta.delta([FVariantValueDeltaOperation.all(Colors.transparent)]),
                border: FVariantsValueDelta.delta([FVariantValueDeltaOperation.all(InputBorder.none)]),
              ),
            )),
    ])),
  );
  return onTap == null ? pill : FTappable(onPress: onTap, semanticsLabel: _hint, child: ExcludeSemantics(child: pill));
}

/// Raccourcis vers la recherche : des pastilles, sans état sélectionné, puisque rien n'est filtré ici.
Widget _categoryPills(BuildContext context) => Padding(
  padding: const EdgeInsets.symmetric(horizontal: Insets.page),
  child: AppChoice<String?>(
    options: const [null, 'homme', 'femme', 'enfant'], selected: const {},
    label: (k) => k == null ? 'Tous' : specialties[k]!,
    onChanged: (k) => context.push(k == null ? '/client/recherche' : '/client/recherche?specialite=$k'),
  ),
);

Widget sectionHeader(BuildContext context, String text, VoidCallback onTap) => FTappable(onPress: onTap, semanticsLabel: text, behavior: HitTestBehavior.opaque, child: ExcludeSemantics(child: Padding(
  padding: const EdgeInsets.fromLTRB(Insets.page, Insets.xl, Insets.page, Insets.md),
  child: Row(children: [Expanded(child: Text(text, style: context.text.titleLarge)), Icon(FIcons.chevronRight, size: 20, color: context.colors.onSurface)]),
)));

// Photo à largeur fixe, texte qui suit la police système : la bande grandit avec elle.
double _stripHeight(BuildContext context) => 164 + 78 * MediaQuery.textScalerOf(context).scale(1);

Widget strip(BuildContext context, List<Atelier> list, {bool hero = true}) => SizedBox(
  height: _stripHeight(context),
  child: ListView.separated(
    scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: Insets.page), itemCount: list.length,
    separatorBuilder: (_, _) => const SizedBox(width: Insets.md), itemBuilder: (_, i) => AtelierCard(list[i], width: 260, hero: hero),
  ),
);

class ClientHomeScreen extends ConsumerStatefulWidget {
  const ClientHomeScreen({super.key});
  @override
  ConsumerState<ClientHomeScreen> createState() => _ClientHomeState();
}

class _ClientHomeState extends ConsumerState<ClientHomeScreen> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // La localisation a pu être activée dans les réglages pendant l'absence.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) ref.invalidate(locationServiceProvider);
  }

  @override
  Widget build(BuildContext context) => AppScaffold(
    onRefresh: () => Future.wait([promotionsProvider(ref).refetch(), verifiedProvider(ref).refetch(), ?nearbyProvider(ref)?.refetch()]),
    body: ListView(children: [
      const ReviewNudge(),
      const SizedBox(height: Insets.md),
      Padding(padding: const EdgeInsets.symmetric(horizontal: Insets.page), child: searchPill(context, onTap: () => context.push('/client/recherche'))),
      const SizedBox(height: Insets.xl),
      _categoryPills(context),
      promotionsProvider(ref).watch((promos, _) => promos == null || promos.isEmpty ? const SizedBox.shrink() : Padding(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.xl, Insets.page, 0), child: _Promos(promos))),
      _nearby(context, ref),
      verifiedProvider(ref).watch((list, error) {
        if (list == null) return error != null ? const SizedBox.shrink() : Column(children: [SizedBox(height: _stripHeight(context), child: const AppSkeleton(rows: 1, height: 236)), const AppWaking()]);
        final verified = list.where((a) => a.verified).toList();
        if (verified.isEmpty) return const SizedBox.shrink();
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [sectionHeader(context, 'Ateliers vérifiés', () => context.push('/client/recherche')), strip(context, verified, hero: false)]);
      }),
      const SizedBox(height: Insets.xl),
      Center(child: AppButton('Voir la carte', variant: AppButtonVariant.ghost, icon: FIcons.map, size: 44, onPressed: () => context.push('/client/carte'))),
      const SizedBox(height: Insets.xxl),
    ]),
  );

  Widget _nearby(BuildContext context, WidgetRef ref) {
    final serviceOn = ref.watch(locationServiceProvider).value;
    if (serviceOn == false) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(Insets.page, Insets.xl, Insets.page, 0),
        child: AppCard.rows([AppRow(leading: const Icon(FIcons.mapPin), title: 'Choisir ma région', subtitle: 'Localisation désactivée', onTap: () => _pickRegion(context, ref))]),
      );
    }
    if (serviceOn != true || ref.watch(locationProvider).isLoading) return const SizedBox.shrink();
    final near = nearbyProvider(ref);
    if (near == null) return Padding(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.xl, Insets.page, 0), child: AppButton('Activer ma position', variant: AppButtonVariant.secondary, icon: FIcons.navigation, onPressed: () => _locate(context, ref)));
    return near.watch((list, _) => list == null || list.isEmpty ? const SizedBox.shrink() : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      sectionHeader(context, 'Près de chez vous', () => context.push('/client/carte')), strip(context, list),
    ]));
  }

  Future<void> _locate(BuildContext context, WidgetRef ref) async {
    final outcome = await ref.read(locationProvider.notifier).request();
    if (outcome == LocationOutcome.located || !context.mounted) return;
    if (outcome == LocationOutcome.settings) return toast(context, 'Autorisez la position dans les réglages du téléphone.');
    toast(context, 'Position refusée. Choisissez votre région.');
    await _pickRegion(context, ref);
  }

  Future<void> _pickRegion(BuildContext context, WidgetRef ref) async {
    final r = await pick<String>(context, title: 'Région', options: regions, label: (r) => r);
    if (r != null && context.mounted) context.push('/client/recherche?region=${Uri.encodeQueryComponent(r)}');
  }
}

class _Promos extends StatefulWidget {
  const _Promos(this.items);
  final List<Promotion> items;
  @override
  State<_Promos> createState() => _PromosState();
}

class _PromosState extends State<_Promos> {
  final _page = PageController();
  Timer? _timer;
  int _i = 0;
  bool _cycled = false;

  @override
  void didChangeDependencies() { super.didChangeDependencies(); _start(); }
  @override
  void dispose() { _timer?.cancel(); _page.dispose(); super.dispose(); }

  /// Un seul tour, et rien du tout si le système demande moins d'animations.
  void _start() {
    _timer?.cancel();
    if (_cycled || widget.items.length < 2 || MediaQuery.disableAnimationsOf(context)) return;
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!_page.hasClients) return;
      final next = _i + 1;
      if (next >= widget.items.length) { _cycled = true; _timer?.cancel(); return; }
      _page.animateToPage(next, duration: Motion.enter, curve: Curves.easeOutCubic);
    });
  }

  void _open(BuildContext context, Promotion p) {
    final target = p.atelierId != null ? '/client/ateliers/${p.atelierId}' : p.searchQuery != null ? '/client/recherche?q=${Uri.encodeQueryComponent(p.searchQuery!)}' : null;
    if (target != null) context.push(target);
  }

  @override
  Widget build(BuildContext context) {
    final scrim = context.colors.scrim;
    return Listener(
      onPointerDown: (_) => _timer?.cancel(), onPointerUp: (_) => _start(), onPointerCancel: (_) => _start(),
      child: AspectRatio(aspectRatio: 16 / 9, child: Stack(children: [
        PageView.builder(
          controller: _page, itemCount: widget.items.length, onPageChanged: (i) => setState(() => _i = i),
          itemBuilder: (_, i) {
            final p = widget.items[i];
            final content = Stack(fit: StackFit.expand, children: [
              AppPhoto(p.imageUrl, fallbackText: p.title, aspectRatio: 16 / 9),
              Container(
                alignment: Alignment.bottomLeft, padding: const EdgeInsets.all(Insets.page),
                decoration: BoxDecoration(borderRadius: Radii.container, gradient: LinearGradient(begin: Alignment.center, end: Alignment.bottomCenter, colors: [scrim.withValues(alpha: 0), scrim.withValues(alpha: .65)])),
                child: Text(p.title, style: context.text.titleLarge!.copyWith(color: _onPhoto), maxLines: 2, overflow: TextOverflow.ellipsis),
              ),
            ]);
            final hasTarget = p.atelierId != null || p.searchQuery != null;
            return hasTarget ? FTappable(onPress: () => _open(context, p), semanticsLabel: p.title, child: ExcludeSemantics(child: content)) : content;
          },
        ),
        if (widget.items.length > 1) Positioned(right: Insets.page, bottom: Insets.page, child: Row(children: [
          for (var i = 0; i < widget.items.length; i++) AnimatedContainer(
            duration: Motion.base, width: i == _i ? Insets.lg : Insets.sm - 2, height: Insets.sm - 2, margin: const EdgeInsets.only(left: Insets.xs),
            decoration: BoxDecoration(color: _onPhoto.withValues(alpha: i == _i ? 1 : .5), borderRadius: Radii.full),
          ),
        ])),
      ])),
    );
  }
}

/// Carte photo : largeur fixe dans les carrousels, pleine largeur dans la recherche.
class AtelierCard extends ConsumerStatefulWidget {
  const AtelierCard(this.a, {super.key, this.width, this.hero = true});
  final Atelier a;
  final double? width;
  final bool hero;
  @override
  ConsumerState<AtelierCard> createState() => AtelierCardState();
}

class AtelierCardState extends ConsumerState<AtelierCard> {
  late bool _fav = widget.a.isFavorite;

  @override
  void didUpdateWidget(AtelierCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.a.isFavorite != widget.a.isFavorite) _fav = widget.a.isFavorite;
  }

  Future<void> _toggle() async {
    final fav = await _setFavorite(context, ref, widget.a, !_fav);
    if (mounted) setState(() => _fav = fav);
  }

  /// Appel direct depuis la carte, compte ou non : la trace suit le même chemin que depuis la fiche.
  Future<void> _call() async {
    final a = widget.a;
    await launchUrl(Uri.parse('tel:${a.phone}'));
    if (ref.read(userProvider) == null) return addPendingContact(a.id, 'phone');
    ref.read(apiProvider).post('/ateliers/${a.id}/contacts', {'channel': 'phone'}).then((_) => invalidate({'contacts', 'atelier'})).ignore();
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.a, caption = context.text.bodySmall!.copyWith(color: context.tones.inkSecondary);
    final photo = AppPhoto(a.coverThumbUrl, fallbackText: a.name);
    return FTappable(onPress: () => context.push('/client/ateliers/${a.id}', extra: a), semanticsLabel: a.name, behavior: HitTestBehavior.opaque, child: SizedBox(width: widget.width, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Stack(children: [
        widget.hero ? Hero(tag: 'atelier-cover-${a.id}', child: photo) : photo,
        if (a.verified) Positioned(left: Insets.md, top: Insets.md, child: DecoratedBox(
          decoration: BoxDecoration(color: context.colors.surface, borderRadius: Radii.full, boxShadow: AppShadow.card),
          child: Padding(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: Insets.xs), child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(FIcons.badgeCheck, size: 14, color: context.colors.onSurface), const SizedBox(width: Insets.xs), Text('Vérifié', style: context.text.bodySmall!.copyWith(fontWeight: FontWeight.w600)),
          ])),
        )),
        Positioned(right: Insets.md, top: Insets.md, child: Row(spacing: Insets.sm, children: [
          if (a.phone != null) _bubble(context, FIcons.phone, 'Appeler ${a.name}', _call),
          _bubble(context, FIcons.heart, _fav ? 'Retirer des favoris' : 'Ajouter aux favoris', _toggle, color: _fav ? context.tones.accent : null),
        ])),
      ]),
      const SizedBox(height: Insets.md),
      Text(a.name, style: context.text.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
      if (_meta(a).isNotEmpty) Text(_meta(a), style: caption, maxLines: 1, overflow: TextOverflow.ellipsis),
      const SizedBox(height: Insets.xs),
      Row(children: [
        if (a.rating != null) ...[Icon(FIcons.star, size: 16, color: context.colors.onSurface), const SizedBox(width: Insets.xs), Text(_num.format(a.rating), style: context.text.labelLarge)],
        if (a.rating != null && a.distanceKm != null) Text('  ·  ', style: caption),
        if (a.distanceKm != null) Text(_km(a.distanceKm!), style: caption),
      ]),
    ])));
  }
}

class AtelierScreen extends ConsumerWidget {
  const AtelierScreen(this.id, {super.key, this.initial});
  final int id;
  // Fiche venue de la liste : suffit hors ligne pour appeler quand le détail n'a jamais été chargé.
  final Atelier? initial;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(locationProvider);
    final res = atelierProvider(ref, id);
    return res.watch((a, error) {
      final shown = a ?? (error == null ? null : initial);
      if (shown != null) return _AtelierDetail(shown, partial: a == null, onRetry: res.refetch);
      return AppScaffold(body: error == null ? const AppSkeleton(rows: 3, height: 160) : AppState.fromError(error, onRetry: res.refetch));
    });
  }
}

/// Couverture en plein bandeau qui se replie : le nom apparaît dans la barre à mesure que la photo disparaît.
class _Cover extends SliverPersistentHeaderDelegate {
  const _Cover(this.a, {required this.height, required this.top, required this.fav, required this.onFav, required this.onMore});
  final Atelier a;
  final double height, top;
  final bool fav;
  final VoidCallback onFav, onMore;

  @override
  double get maxExtent => height;
  @override
  double get minExtent => top + 56;
  @override
  bool shouldRebuild(_Cover old) => old.fav != fav || old.height != height || old.top != top || old.a != a;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final t = (shrinkOffset / (maxExtent - minExtent)).clamp(0.0, 1.0);
    return Stack(fit: StackFit.expand, children: [
      Hero(tag: 'atelier-cover-${a.id}', child: AppPhoto(a.coverUrl, placeholderUrl: a.coverThumbUrl, fallbackText: a.name, radius: BorderRadius.zero)),
      Opacity(opacity: t, child: ColoredBox(color: context.colors.surface)),
      Positioned(top: top, left: Insets.sm, right: Insets.sm, height: 56, child: Row(spacing: Insets.sm, children: [
        _bubble(context, FIcons.arrowLeft, 'Retour', () => context.pop()),
        Expanded(child: Opacity(opacity: t, child: Text(a.name, style: context.text.titleMedium, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis))),
        _bubble(context, FIcons.heart, fav ? 'Retirer des favoris' : 'Ajouter aux favoris', onFav, color: fav ? context.tones.accent : null),
        _bubble(context, FIcons.ellipsis, 'Plus', onMore),
      ])),
    ]);
  }
}

class _AtelierDetail extends ConsumerStatefulWidget {
  const _AtelierDetail(this.a, {this.partial = false, this.onRetry});
  final Atelier a;
  // Fiche servie depuis la liste faute de détail : la page le dit et propose de réessayer.
  final bool partial;
  final VoidCallback? onRetry;
  @override
  ConsumerState<_AtelierDetail> createState() => _AtelierDetailState();
}

class _AtelierDetailState extends ConsumerState<_AtelierDetail> {
  late bool _fav = widget.a.isFavorite;

  Atelier get a => widget.a;
  String get _next => '/client/ateliers/${a.id}';

  @override
  void initState() {
    super.initState();
    // L'écran vient d'être créé : une action mise en attente avant l'écran de connexion l'attend peut-être déjà.
    WidgetsBinding.instance.addPostFrameCallback((_) => _replay());
  }

  @override
  void didUpdateWidget(_AtelierDetail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.a.isFavorite != widget.a.isFavorite) _fav = widget.a.isFavorite;
  }

  /// Après connexion, la même URL est réaffichée sans recréer l'écran : c'est le changement de compte qui déclenche.
  void _replay() {
    if (!mounted) return;
    final intent = takePendingIntent(_next);
    if (intent == null) return;
    switch (intent) {
      case 'favori': _toggleFavorite();
      case 'avis': _review();
      case 'signalement': _openReport();
      default: _contact(intent);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(userProvider, (before, after) {
      if (before == null && after != null) WidgetsBinding.instance.addPostFrameCallback((_) => _replay());
    });
    final caption = context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary);
    final guest = ref.watch(userProvider) == null;
    final pad = MediaQuery.paddingOf(context), thumbs = a.photoThumbs;
    final hours = (a.raw['hours'] as String?)?.trim() ?? '';
    final priceFrom = (a.raw['price_from'] as num?)?.toInt();
    final info = <FTileMixin>[
      if (a.region != null || a.address?.isNotEmpty == true) AppRow(title: a.region ?? a.address!, subtitle: a.region == null ? null : a.address, leading: const Icon(FIcons.mapPin)),
      if (a.latitude != null && a.longitude != null) AppRow(title: 'Itinéraire', subtitle: 'Ouvrir dans Maps', leading: const Icon(FIcons.route), onTap: _directions),
      if (a.distanceKm != null) AppRow(title: 'À ${_km(a.distanceKm!)}', leading: const Icon(FIcons.navigation)),
      if (hours.isNotEmpty) AppRow(title: 'Horaires', subtitle: hours, leading: const Icon(FIcons.clock)),
      if (a.phone != null) AppRow(title: prettyPhone(a.phone!), subtitle: 'Appuyez longuement pour copier', leading: const Icon(FIcons.phone), onLongPress: _copyPhone),
    ];
    return Material(type: MaterialType.transparency, child: FScaffold(
      childPad: false,
      footer: ColoredBox(color: context.colors.surface, child: Padding(
        padding: EdgeInsets.fromLTRB(Insets.page, Insets.md, Insets.page, Insets.md + pad.bottom),
        child: _actions(context),
      )),
      child: CustomScrollView(slivers: [
        SliverPersistentHeader(pinned: true, delegate: _Cover(a, height: MediaQuery.sizeOf(context).width * 10 / 16, top: pad.top, fav: _fav, onFav: _toggleFavorite, onMore: _more)),
        SliverPadding(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.page, Insets.page, Insets.xxl), sliver: SliverList.list(children: [
          if (widget.partial) ...[
            AppCard(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.xs, Insets.sm, Insets.xs), child: Row(children: [
              Expanded(child: Text('Données partielles', style: caption)),
              AppButton('Réessayer', variant: AppButtonVariant.ghost, size: 44, onPressed: widget.onRetry),
            ])),
            const SizedBox(height: Insets.lg),
          ],
          AppCard(padding: const EdgeInsets.all(Insets.page), child: Row(children: [
            AppAvatar(name: a.name, imageUrl: a.logoThumbUrl, size: 56), const SizedBox(width: Insets.lg),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(a.name, style: context.text.headlineMedium),
              if (a.specialties.isNotEmpty) Text(a.specialties.map((s) => specialties[s] ?? s).join(' · '), style: caption),
              if (priceFrom != null) Text('À partir de ${formatCfa(priceFrom)}', style: context.text.labelLarge),
            ])),
            if (a.verified) ...[const SizedBox(width: Insets.sm), const AppTag('Vérifié', tone: AppTone.success)],
          ])),
          if (info.isNotEmpty) ...[const SizedBox(height: Insets.lg), AppCard.rows(info)],
          if ([a.tiktok, a.instagram, a.facebook].any((s) => s?.isNotEmpty == true)) ...[
            const AppSection('Réseaux'),
            AppCard.rows([
              for (final (network, handle, icon) in [('tiktok', a.tiktok, FIcons.music), ('instagram', a.instagram, FIcons.instagram), ('facebook', a.facebook, FIcons.facebook)])
                if (handle?.isNotEmpty == true)
                  AppRow(leading: Icon(icon), title: socialLabels[network]!, subtitle: '@${socialHandle(handle!)}', trailing: Icon(FIcons.externalLink, color: context.tones.inkTertiary),
                    onTap: () => launchUrl(Uri.parse(socialUrl(network, handle)), mode: LaunchMode.externalApplication)),
            ]),
          ],
          if (a.photos.isNotEmpty) ...[
            const AppSection('Portfolio'),
            SizedBox(height: 132, child: ListView.separated(
              scrollDirection: Axis.horizontal, itemCount: a.photos.length, separatorBuilder: (_, _) => const SizedBox(width: Insets.sm),
              itemBuilder: (_, i) => FTappable(
                onPress: () => Navigator.of(context, rootNavigator: true).push(MaterialPageRoute(builder: (_) => _Gallery(a.photos, index: i))), semanticsLabel: 'Photo ${i + 1}',
                child: SizedBox(width: 132, child: AppPhoto(thumbs[i], fallbackText: a.name, aspectRatio: 1, radius: Radii.control)),
              ),
            )),
          ],
          if (a.description?.isNotEmpty == true) ...[const AppSection('À propos'), AppCard(padding: const EdgeInsets.all(Insets.page), child: Text(a.description!, style: context.text.bodyLarge))],
          AppSection('Avis', action: a.reviewsCount > 2 ? 'Tout voir' : null, onAction: _allReviews),
          AppCard(padding: const EdgeInsets.all(Insets.page), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (a.rating != null) Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(_num.format(a.rating), style: context.text.displayLarge), const SizedBox(width: Insets.md),
              Padding(padding: const EdgeInsets.only(bottom: Insets.sm), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Stars(a.rating!, size: 18), Text('${a.reviewsCount} avis', style: caption)])),
            ]),
            for (final r in a.reviews.take(2)) _reviewTile(context, r),
            const SizedBox(height: Insets.sm),
            if (guest || a.raw['can_review'] == true)
              AppButton('Donner mon avis', variant: AppButtonVariant.secondary, icon: FIcons.messageSquare, onPressed: _review)
            else
              Text('Contactez d\'abord l\'atelier pour laisser un avis.', style: caption),
          ])),
        ])),
      ]),
    ));
  }

  /// Appeler d'abord ; à grande police les trois actions passent en colonne plutôt que de se serrer.
  Widget _actions(BuildContext context) {
    final call = a.phone == null ? null : AppButton('Appeler', onPressed: () => _contact('phone'));
    final whatsapp = a.phone == null ? null : AppButton('WhatsApp', variant: AppButtonVariant.secondary, onPressed: () => _contact('whatsapp'));
    final quote = AppButton('Demander un devis', variant: AppButtonVariant.secondary, onPressed: () => _contact('request'));
    if (MediaQuery.textScalerOf(context).scale(1) >= 1.5) {
      return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, spacing: Insets.sm, children: [?call, quote, ?whatsapp]);
    }
    if (call == null) return quote;
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, spacing: Insets.sm, children: [
      Row(spacing: Insets.sm, children: [Expanded(child: call), Expanded(child: whatsapp!)]),
      quote,
    ]);
  }

  Future<bool> _post(String path, Json body, {Set<String> stale = const {}, String? done}) async {
    try { await ref.read(apiProvider).post(path, body); }
    on ApiException catch (e) { if (mounted) toast(context, e.message); return false; }
    invalidate(stale);
    if (done != null && mounted) toast(context, done);
    return true;
  }

  /// Appel et WhatsApp partent sans compte et sans attendre le serveur : la trace est écrite après, si le compte existe.
  Future<void> _contact(String channel) async {
    if (channel == 'request') {
      if (!await requireAccount(context, ref, next: _next, intent: channel) || !mounted) return;
      return _request();
    }
    if (channel == 'phone') {
      await launchUrl(Uri.parse('tel:${a.phone}'));
    } else {
      var opened = false;
      try { opened = await launchUrl(Uri.parse('https://wa.me/221${phoneDigits(a.phone!)}'), mode: LaunchMode.externalApplication); } catch (_) {}
      if (!opened) await launchUrl(Uri.parse('sms:${a.phone}'));
    }
    // Sans compte, la trace attend : elle part telle quelle à la première connexion.
    if (ref.read(userProvider) == null) return addPendingContact(a.id, channel);
    ref.read(apiProvider).post('/ateliers/${a.id}/contacts', {'channel': channel}).then((_) => invalidate({'contacts', 'atelier'})).ignore();
  }

  Future<void> _request() async {
    final msg = TextEditingController();
    try {
      var share = false;
      String? error;
      final ok = await showAppSheet<bool>(context, title: 'Demander un devis', child: StatefulBuilder(builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        AppField(label: 'Message', controller: msg, hint: 'Décrivez ce que vous souhaitez faire coudre', maxLines: 4, maxLength: 1000, autofocus: true, error: error),
        const SizedBox(height: Insets.sm),
        AppRow(title: 'Partager mon numéro', subtitle: 'L\'atelier pourra vous rappeler.', onTap: () => set(() => share = !share),
          trailing: FCheckbox(value: share, semanticsLabel: 'Partager mon numéro', onChange: (v) => set(() => share = v))),
        const SizedBox(height: Insets.lg),
        AppButton('Envoyer la demande', onPressed: () => msg.text.trim().isEmpty ? set(() => error = 'Décrivez votre demande en quelques mots.') : popSheet(ctx, true)),
      ])));
      if (ok != true) return;
      final sent = await _post('/ateliers/${a.id}/contacts', {'channel': 'request', 'message': msg.text.trim(), 'share_phone': share}, stale: {'contacts'}, done: a.phone == null ? 'Demande envoyée à ${a.name}.' : null);
      if (!sent) return;
      if (a.phone != null && mounted) await _callNow();
    } finally {
      msg.dispose();
    }
  }

  /// Demande partie : l'appel reste le geste le plus direct, on le propose dans la foulée.
  Future<void> _callNow() async {
    final call = await confirm(context, title: 'Demande envoyée à ${a.name}', message: 'Vous pouvez aussi l\'appeler tout de suite.', action: 'Appeler maintenant');
    if (call && mounted) await _contact('phone');
  }

  Future<void> _toggleFavorite() async {
    final fav = await _setFavorite(context, ref, a, !_fav);
    if (mounted) setState(() => _fav = fav);
  }

  void _more() => showAppSheet(context, child: Column(mainAxisSize: MainAxisSize.min, children: [
    AppRow(title: 'Partager cet atelier', leading: const Icon(FIcons.share2), onTap: () { popSheet(context); _share(); }),
    const AppDivider(inset: false),
    AppRow(title: 'Signaler cet atelier', leading: const Icon(FIcons.flag), onTap: () { popSheet(context); _openReport(); }),
  ]));

  void _share() {
    final where = a.region == null ? '' : ' à ${a.region}';
    SharePlus.instance.share(ShareParams(text: '${a.name}, atelier de couture$where. ${a.raw['share_url'] ?? atelierLink(a.id)}'));
  }

  void _directions() => launchUrl(Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${a.latitude},${a.longitude}'), mode: LaunchMode.externalApplication);

  Future<void> _copyPhone() async {
    await Clipboard.setData(ClipboardData(text: a.phone!));
    if (mounted) toast(context, 'Numéro copié.');
  }

  Future<void> _openReport() async {
    if (!await requireAccount(context, ref, next: _next, intent: 'signalement') || !mounted) return;
    final reason = TextEditingController();
    try {
      String? error;
      final ok = await showAppSheet<bool>(context, title: 'Signaler cet atelier', child: StatefulBuilder(builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        AppField(label: 'Motif', controller: reason, hint: 'Expliquez le problème', maxLines: 3, maxLength: 500, autofocus: true, error: error),
        const SizedBox(height: Insets.lg),
        AppButton('Envoyer le signalement', variant: AppButtonVariant.danger, onPressed: () => reason.text.trim().isEmpty ? set(() => error = 'Indiquez le motif.') : popSheet(ctx, true)),
      ])));
      if (ok == true) await _post('/signalements', {'type': 'atelier', 'id': a.id, 'reason': reason.text.trim()}, done: 'Signalement envoyé.');
    } finally {
      reason.dispose();
    }
  }

  Future<void> _review() async {
    if (!await requireAccount(context, ref, next: _next, intent: 'avis') || !mounted) return;
    final text = TextEditingController();
    try {
      var rating = 0;
      final ok = await showAppSheet<bool>(context, title: 'Donner mon avis', child: StatefulBuilder(builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Center(child: Stars(rating, size: 32, onChanged: (v) => set(() => rating = v))),
        const SizedBox(height: Insets.lg),
        AppField(label: 'Commentaire', controller: text, hint: 'Facultatif', maxLines: 3),
        const SizedBox(height: Insets.lg),
        AppButton('Publier mon avis', onPressed: rating == 0 ? null : () => popSheet(ctx, true)),
      ])));
      if (ok == true) await _post('/avis', {'atelier_id': a.id, 'rating': rating, if (text.text.trim().isNotEmpty) 'text': text.text.trim()}, stale: reviewStale, done: 'Merci pour votre avis.');
    } finally {
      text.dispose();
    }
  }

  void _allReviews() => showAppSheet(context, title: 'Avis', child: ConstrainedBox(
    constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * .7),
    child: Remote(reviewsProvider(ref, a.id), skeleton: const AppSkeleton(rows: 3),
      builder: (list) => ListView.separated(shrinkWrap: true, itemCount: list.length, separatorBuilder: (_, _) => const AppDivider(inset: false), itemBuilder: (ctx, i) => _reviewTile(ctx, list[i]))),
  ));
}

Widget _reviewTile(BuildContext context, Review r) => Padding(padding: const EdgeInsets.symmetric(vertical: Insets.md), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
  Row(children: [
    AppAvatar(name: r.userName, size: 36), const SizedBox(width: Insets.md),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(r.userName, style: context.text.labelLarge, maxLines: 1, overflow: TextOverflow.ellipsis),
      Text(DateFormat('d MMM yyyy', 'fr').format(r.at), style: context.text.bodySmall!.copyWith(color: context.tones.inkSecondary)),
    ])),
    Stars(r.rating, size: 14),
  ]),
  if (r.text?.isNotEmpty == true) ...[const SizedBox(height: Insets.sm), Text(r.text!, style: context.text.bodyMedium)],
]));

class _Gallery extends StatefulWidget {
  const _Gallery(this.photos, {required this.index});
  final List<String> photos;
  final int index;
  @override
  State<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends State<_Gallery> {
  late final _page = PageController(initialPage: widget.index);

  @override
  void dispose() { _page.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => ColoredBox(color: context.colors.scrim, child: Stack(children: [
    PageView.builder(
      controller: _page, itemCount: widget.photos.length,
      itemBuilder: (_, i) => InteractiveViewer(maxScale: 4, child: Center(child: CachedNetworkImage(imageUrl: widget.photos[i], cacheManager: photoCache, fit: BoxFit.contain))),
    ),
    Positioned(top: MediaQuery.paddingOf(context).top + Insets.sm, left: Insets.sm, child: _bubble(context, FIcons.x, 'Fermer', () => popSheet(context))),
  ]));
}
