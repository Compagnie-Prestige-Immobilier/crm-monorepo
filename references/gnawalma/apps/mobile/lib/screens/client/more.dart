import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart' show Distance, LatLng, LengthUnit;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:share_plus/share_plus.dart';

import '../../api.dart';
import '../../config.dart';
import '../../models.dart';
import '../../queries.dart';
import '../../session.dart';
import '../../ui.dart';
import '../auth.dart' show deleteAccountFlow;
import 'home.dart' show requireAccount, reviewStale, AtelierCard;

Res<List<Atelier>> favoritesProvider(WidgetRef ref) => Res.list(ref, ['favoris', uid(ref)], (api) => api.get('/mes-favoris'), Atelier.fromJson);
Pages<Contact> contactsProvider(WidgetRef ref) => Pages(ref, ['contacts', uid(ref)], (api, page) => api.get('/mes-contacts', query: {'page': page, 'limit': 30}), decodeContact);

const _dakar = LatLng(14.6928, -17.4467);
const _channels = {'phone': 'Appel', 'whatsapp': 'WhatsApp', 'request': 'Demande'};
const _themes = {'system': 'Système', 'light': 'Clair', 'dark': 'Sombre'};

String _km(double d) => '${d.toStringAsFixed(d < 10 ? 1 : 0)} km';

String _when(DateTime d) {
  final days = DateTime.now().difference(d).inDays;
  if (days == 0) return 'Aujourd\'hui';
  if (days == 1) return 'Hier';
  if (days < 7) return 'Il y a $days jours';
  return DateFormat('d MMM', 'fr').format(d);
}

Widget _thumb(String? url, String name, {double size = 48}) => SizedBox(width: size, child: AppPhoto(url, fallbackText: name, aspectRatio: 1, radius: Radii.control));

const _listPadding = EdgeInsets.fromLTRB(Insets.page, 0, Insets.page, Insets.xxl);

class _Gate extends ConsumerWidget {
  const _Gate({required this.title, required this.message, required this.next});
  final String title, message, next;
  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      AppState(kind: AppStateKind.permission, title: title, message: message, actionLabel: 'Se connecter', onAction: () => requireAccount(context, ref, next: next));
}

/// Étoiles pleines pour la note obtenue, en simple contour au-delà : la forme distingue, pas seulement la couleur.
class Stars extends StatelessWidget {
  const Stars(this.value, {super.key, this.size = 16, this.onChanged});
  final num value;
  final double size;
  final ValueChanged<int>? onChanged;
  @override
  Widget build(BuildContext context) {
    final filled = value.round();
    Widget star(int i) => CustomPaint(size: Size.square(size), painter: _StarPainter(i <= filled ? context.tones.accent : context.tones.inkTertiary, filled: i <= filled));
    if (onChanged == null) {
      return Semantics(label: '$filled étoiles sur 5', excludeSemantics: true, child: Row(mainAxisSize: MainAxisSize.min, children: [
        for (var i = 1; i <= 5; i++) Padding(padding: const EdgeInsets.all(1), child: star(i)),
      ]));
    }
    return Row(mainAxisSize: MainAxisSize.min, children: [
      for (var i = 1; i <= 5; i++)
        Semantics(
          button: true, selected: i <= filled, label: '$i étoile${i > 1 ? 's' : ''} sur 5', excludeSemantics: true, onTap: () => onChanged!(i),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque, onTap: () => onChanged!(i),
            child: SizedBox.square(dimension: math.max(48, size + Insets.md), child: Center(child: star(i))),
          ),
        ),
    ]);
  }
}

class _StarPainter extends CustomPainter {
  const _StarPainter(this.color, {required this.filled});
  final Color color;
  final bool filled;
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero), r = size.width / 2 - (filled ? 0 : 1), path = Path();
    for (var i = 0; i < 10; i++) {
      final a = -math.pi / 2 + i * math.pi / 5, d = i.isEven ? r : r * .45;
      final p = Offset(c.dx + d * math.cos(a), c.dy + d * math.sin(a));
      i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
    }
    final paint = Paint()..color = color..strokeWidth = 1.5..strokeJoin = StrokeJoin.round..style = filled ? PaintingStyle.fill : PaintingStyle.stroke;
    canvas.drawPath(path..close(), paint);
  }
  @override
  bool shouldRepaint(_StarPainter old) => old.color != color || old.filled != filled;
}

/// La porte des couturiers, comme « Devenir hôte » chez Airbnb : inscription pour l'invité, bascule de rôle pour le client connecté.
Widget _openAtelierCard(BuildContext context, VoidCallback onTap) => AppCard(
  onTap: onTap, padding: const EdgeInsets.all(Insets.page),
  child: Row(spacing: Insets.lg, children: [
    Icon(FIcons.scissors, size: 28, color: context.colors.onSurface),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, spacing: Insets.xs, children: [
      Text('Ouvrir mon atelier', style: context.text.titleMedium),
      Text('Vos commandes, vos clients et une vitrine vue par les clients proches.', style: context.text.bodySmall!.copyWith(color: context.tones.inkSecondary)),
    ])),
    Icon(FIcons.chevronRight, color: context.tones.inkTertiary),
  ]),
);

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});
  @override
  ConsumerState<MapScreen> createState() => _MapState();
}

class _MapState extends ConsumerState<MapScreen> {
  static const _distance = Distance();
  final _map = MapController();
  Atelier? _selected;
  LatLng? _me, _center;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _locate(request: false));
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _map.dispose();
    super.dispose();
  }

  /// Un petit déplacement ne relit rien : nouveau centre au-delà de 2 km, une demi-seconde après l'arrêt.
  void _recenter(LatLng to) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      final from = _center ?? _me ?? _dakar;
      if (!mounted || _distance.as(LengthUnit.Kilometer, from, to) < 2) return;
      setState(() => _center = to);
    });
  }

  Future<void> _locate({required bool request}) async {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied && request) perm = await Geolocator.requestPermission();
    final granted = perm == LocationPermission.always || perm == LocationPermission.whileInUse;
    if (granted) {
      try {
        final p = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.low, timeLimit: Duration(seconds: 10)));
        if (!mounted) return;
        setState(() => _me = LatLng(p.latitude, p.longitude));
        _map.move(_me!, 13);
      } catch (_) {}
    } else if (request && mounted) {
      toast(context, 'Autorisez la localisation pour vous situer sur la carte.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final ink = context.colors.onSurface, surface = context.colors.surface, c = _center ?? _me ?? _dakar;
    // Clé arrondie : deux centres à quelques dizaines de mètres partagent le même cache.
    final ateliers = Res.page(ref, ['carte', uid(ref), c.latitude.toStringAsFixed(2), c.longitude.toStringAsFixed(2)],
        (api) => api.get('/ateliers', query: {'lat': c.latitude, 'lng': c.longitude, 'limit': 50}), Atelier.fromJson);
    return AppScaffold(
      actions: [AppIconButton(icon: FIcons.locateFixed, label: 'Ma position', onTap: () => _locate(request: true))],
      body: ateliers.watch((list, _) => Stack(children: [
        FlutterMap(
          mapController: _map,
          options: MapOptions(
            initialCenter: _dakar, initialZoom: 12, onTap: (_, _) => setState(() => _selected = null),
            onMapEvent: (e) { if (e is MapEventMoveEnd) _recenter(e.camera.center); },
          ),
          children: [
            TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', userAgentPackageName: 'com.lic.gnawalma'),
            MarkerLayer(markers: [
              for (final a in list ?? <Atelier>[]) if (a.latitude != null && a.longitude != null)
                Marker(point: LatLng(a.latitude!, a.longitude!), width: 48, height: 48, child: Semantics(
                  button: true, label: [a.name, ?a.region].join(', '),
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => _selected = a),
                    child: Center(child: AnimatedContainer(
                      duration: Motion.fast, width: a.id == _selected?.id ? 28 : 20, height: a.id == _selected?.id ? 28 : 20,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: ink, border: Border.all(color: surface, width: 2)),
                      child: Center(child: Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: surface))),
                    )),
                  ),
                )),
            ]),
          ],
        ),
        Positioned(top: Insets.sm, left: Insets.page, child: AppButton('Voir en liste', variant: AppButtonVariant.secondary, icon: FIcons.list, size: 48, onPressed: () => context.push('/client/recherche'))),
        Positioned(left: Insets.sm, bottom: Insets.xs, child: Container(
          padding: const EdgeInsets.symmetric(horizontal: Insets.xs),
          color: surface.withValues(alpha: .8),
          child: Text('© OpenStreetMap contributors', style: context.text.bodySmall!.copyWith(color: context.tones.inkSecondary)),
        )),
        Positioned(left: Insets.page, right: Insets.page, bottom: Insets.xl, child: AnimatedSwitcher(
          duration: Motion.base,
          child: _selected == null ? const SizedBox.shrink() : _MapCard(_selected!, key: ValueKey(_selected!.id), distance: _me == null ? null : _selected!.distanceKm),
        )),
      ])),
    );
  }
}

class _MapCard extends StatelessWidget {
  const _MapCard(this.atelier, {super.key, this.distance});
  final Atelier atelier;
  final double? distance;
  @override
  Widget build(BuildContext context) {
    final caption = [if (atelier.region != null) atelier.region, if (distance != null) _km(distance!)].join(' · ');
    return AppCard(
      onTap: () => context.push('/client/ateliers/${atelier.id}', extra: atelier),
      padding: const EdgeInsets.all(Insets.md),
      child: Row(children: [
        _thumb(atelier.coverThumbUrl, atelier.name, size: 64),
        const SizedBox(width: Insets.md),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(atelier.name, style: context.text.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
          if (caption.isNotEmpty) Text(caption, style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary)),
        ])),
        Icon(FIcons.chevronRight, color: context.tones.inkTertiary),
      ]),
    );
  }
}

class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(userProvider) == null) {
      return const AppScaffold(title: 'Favoris', body: _Gate(title: 'Vos ateliers de confiance', message: 'Connectez-vous pour garder sous la main les ateliers qui vous plaisent.', next: '/client/favoris'));
    }
    final favs = favoritesProvider(ref);
    return AppScaffold(
      onRefresh: favs.refetch,
      body: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const AppTitle('Vos favoris', centered: true),
        Expanded(child: Remote(favs,
          builder: (list) => list.isEmpty
              ? AppState(kind: AppStateKind.empty, title: 'Aucun favori', message: 'Ajoutez un atelier à vos favoris depuis sa fiche pour le retrouver ici en un geste.', actionLabel: 'Chercher un atelier', onAction: () => context.go('/client/recherche'))
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(), padding: _listPadding, itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: Insets.xl),
                  itemBuilder: (_, i) => AtelierCard(list[i], key: ValueKey(list[i].id)),
                ),
        )),
      ]),
    );
  }
}

class ActivityScreen extends ConsumerWidget {
  const ActivityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(userProvider) == null) {
      return const AppScaffold(title: 'Activité', body: _Gate(title: 'Votre historique', message: 'Connectez-vous pour retrouver les ateliers que vous avez contactés et laisser un avis.', next: '/client/activite'));
    }
    final contacts = contactsProvider(ref);
    return AppScaffold(
      onRefresh: contacts.refetch,
      body: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const AppTitle('Votre activité', centered: true),
        Expanded(child: PagedList(contacts,
          group: (c) => _period(c.at),
          padding: const EdgeInsets.only(bottom: Insets.xxl),
          empty: AppState(kind: AppStateKind.empty, title: 'Aucun contact', message: 'Les ateliers que vous appelez ou contactez apparaîtront ici.', actionLabel: 'Chercher un atelier', onAction: () => context.go('/client/recherche')),
          item: (c) => _row(context, c),
        )),
      ]),
    );
  }

  String _period(DateTime d) {
    final days = DateTime.now().difference(d).inDays;
    if (days == 0) return 'Aujourd\'hui';
    if (days < 7) return 'Cette semaine';
    if (days < 30) return 'Ce mois-ci';
    return toBeginningOfSentenceCase(DateFormat('MMMM yyyy', 'fr').format(d));
  }

  /// L'avis se donne depuis le bandeau de relance ou la fiche de l'atelier : la ligne n'affiche que la note déjà mise.
  AppRow _row(BuildContext context, Contact c) => AppRow(
    leading: c.atelierCover == null ? AppAvatar(name: c.atelierName, size: 64) : _thumb(c.atelierCover, c.atelierName, size: 64),
    title: c.atelierName, subtitle: '${_channels[c.channel] ?? c.channel} · ${_when(c.at)}',
    trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, spacing: Insets.xs, children: [
      if (c.channel == 'request') AppTag(c.handled ? 'Vue par l\'atelier' : 'En attente', tone: c.handled ? AppTone.success : AppTone.neutral),
      if (c.myRating != null) Stars(c.myRating!),
    ]),
    onTap: c.atelierId == null ? null : () => context.push('/client/ateliers/${c.atelierId}'),
  );
}

class ClientProfileScreen extends ConsumerStatefulWidget {
  const ClientProfileScreen({super.key});
  @override
  ConsumerState<ClientProfileScreen> createState() => _ClientProfileState();
}

class _ClientProfileState extends ConsumerState<ClientProfileScreen> {
  PackageInfo? _info;

  @override
  void initState() {
    super.initState();
    PackageInfo.fromPlatform().then((v) { if (mounted) setState(() => _info = v); });
  }

  String get _version => _info == null ? '' : '${_info!.version} (${_info!.buildNumber})';

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(userProvider);
    if (user == null) return _guest(context);
    final theme = ref.watch(themePrefProvider).value ?? 'system';
    final t = context.tones, secondary = context.text.bodyMedium!.copyWith(color: t.inkSecondary);
    final favs = favoritesProvider(ref).watch((list, _) => Text('${list?.length ?? '–'}'));
    final contacted = contactsProvider(ref).watch((items) => Text('${items?.map((c) => c.atelierId).toSet().length ?? '–'}'));
    return AppScaffold(
      body: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const AppTitle('Profil', centered: true),
        Expanded(child: ListView(padding: _listPadding, children: [
          AppCard(padding: const EdgeInsets.symmetric(vertical: Insets.xl, horizontal: Insets.page), child: Column(children: [
            AppAvatar(name: user.name, size: 88),
            const SizedBox(height: Insets.lg),
            Text(user.name, style: context.text.headlineMedium, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: Insets.xs),
            Text(user.phone == null ? user.identifier : prettyPhone(user.phone!), style: secondary, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
          ])),
          const SizedBox(height: Insets.lg),
          Row(spacing: Insets.lg, children: [
            Expanded(child: AppStatCard(label: 'Favoris', value: favs, onTap: () => context.go('/client/favoris'))),
            Expanded(child: AppStatCard(label: 'Ateliers contactés', value: contacted, onTap: () => context.go('/client/activite'))),
          ]),
          _section(context, 'Compte'),
          AppCard.rows([
            AppRow(leading: const Icon(FIcons.userPen), title: 'Modifier mon nom', subtitle: user.name, onTap: () => _rename(context, ref, user)),
            AppRow(leading: const Icon(FIcons.lock), title: 'Changer mon code', onTap: () => context.push('/client/profil/code')),
          ]),
          _section(context, 'Vous êtes couturier ?'),
          _openAtelierCard(context, () => _becomeAtelier(context, ref)),
          _section(context, 'Application'),
          AppCard.rows([
            AppRow(leading: const Icon(FIcons.sunMoon), title: 'Thème', subtitle: _themes[theme], onTap: () async {
              final v = await pick<String>(context, title: 'Thème', options: _themes.keys.toList(), label: (k) => _themes[k]!, selected: theme);
              if (v != null) await ref.read(themePrefProvider.notifier).set(v == 'system' ? null : v);
            }),
          ]),
          _section(context, 'Aide'),
          AppCard.rows([
            AppRow(leading: const Icon(FIcons.lifeBuoy), title: 'Support client', subtitle: 'WhatsApp, appel, signalement', onTap: () => supportSheet(context, version: _version, identifier: user.identifier)),
          ]),
          _section(context, 'À propos'),
          AppCard.rows([
            AppRow(leading: const Icon(FIcons.info), title: 'Version', trailing: Text(_version, style: secondary)),
            AppRow(leading: const Icon(FIcons.fileText), title: 'Conditions d\'utilisation', onTap: () => showAppSheet<void>(context, title: 'Conditions d\'utilisation', child: Text(termsText, style: context.text.bodyLarge!.copyWith(color: t.inkSecondary)))),
            AppRow(leading: const Icon(FIcons.shield), title: 'Confidentialité', onTap: () => showAppSheet<void>(context, title: 'Confidentialité', child: Text(privacyText, style: context.text.bodyLarge!.copyWith(color: t.inkSecondary)))),
            AppRow(leading: const Icon(FIcons.share), title: 'Partager l\'application', onTap: () => SharePlus.instance.share(ShareParams(text: 'Gnawalma connecte clients et ateliers de couture. Téléchargez l\'application pour trouver le vôtre.'))),
          ]),
          const SizedBox(height: Insets.xl),
          AppCard.rows([
            AppRow(leading: const Icon(FIcons.logOut), title: 'Se déconnecter', danger: true, trailing: const SizedBox.shrink(), onTap: () => _logout(context, ref)),
          ]),
          const SizedBox(height: Insets.lg),
          AppCard.rows([
            AppRow(leading: Icon(FIcons.trash2, color: t.danger), title: 'Supprimer mon compte', danger: true, trailing: const SizedBox.shrink(), onTap: () => deleteAccountFlow(context, ref)),
          ]),
          Padding(padding: const EdgeInsets.symmetric(vertical: Insets.xl), child: Text('Gnawalma · LIC', textAlign: TextAlign.center, style: context.text.bodySmall!.copyWith(color: t.inkTertiary))),
        ])),
      ]),
    );
  }

  /// Invité : connexion, et la porte des couturiers, comme « Devenir hôte » chez Airbnb.
  Widget _guest(BuildContext context) {
    final theme = ref.watch(themePrefProvider).value ?? 'system';
    final t = context.tones, secondary = context.text.bodyMedium!.copyWith(color: t.inkSecondary);
    return AppScaffold(body: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const AppTitle('Profil', centered: true),
      Expanded(child: ListView(padding: _listPadding, children: [
        AppCard(padding: const EdgeInsets.all(Insets.page), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Connectez-vous', style: context.text.titleLarge),
          const SizedBox(height: Insets.xs),
          Text('Retrouvez vos favoris, vos contacts et vos avis.', style: secondary),
          const SizedBox(height: Insets.xl),
          AppButton('Se connecter', onPressed: () => context.push('/connexion?next=/client/profil')),
          const SizedBox(height: Insets.sm),
          AppButton('Créer un compte', variant: AppButtonVariant.secondary, onPressed: () => context.push('/inscription?role=client&next=/client/profil')),
        ])),
        _section(context, 'Vous êtes couturier ?'),
        _openAtelierCard(context, () => context.push('/inscription?role=atelier')),
        const SizedBox(height: Insets.md),
        AppCard.rows([
          AppRow(leading: const Icon(FIcons.logIn), title: 'J\'ai déjà un atelier', subtitle: 'Me connecter à mon espace', onTap: () => context.push('/connexion')),
        ]),
        _section(context, 'Application'),
        AppCard.rows([
          AppRow(leading: const Icon(FIcons.sunMoon), title: 'Thème', subtitle: _themes[theme], onTap: () async {
            final v = await pick<String>(context, title: 'Thème', options: _themes.keys.toList(), label: (k) => _themes[k]!, selected: theme);
            if (v != null) await ref.read(themePrefProvider.notifier).set(v == 'system' ? null : v);
          }),
        ]),
        _section(context, 'Aide'),
        AppCard.rows([
          AppRow(leading: const Icon(FIcons.lifeBuoy), title: 'Support client', subtitle: 'WhatsApp, appel, signalement', onTap: () => supportSheet(context, version: _version)),
        ]),
        Padding(padding: const EdgeInsets.symmetric(vertical: Insets.xl), child: Text('Gnawalma · LIC', textAlign: TextAlign.center, style: context.text.bodySmall!.copyWith(color: t.inkTertiary))),
      ])),
    ]));
  }

  Widget _section(BuildContext context, String label) => Padding(
    padding: const EdgeInsets.fromLTRB(Insets.sm, Insets.xl, Insets.sm, Insets.sm),
    child: Text(label, style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary, fontWeight: FontWeight.w600)),
  );

  Future<void> _rename(BuildContext context, WidgetRef ref, User user) async {
    final ctrl = TextEditingController(text: user.name);
    final String? name;
    try {
      String? error;
      name = await showAppSheet<String>(context, title: 'Votre nom', child: StatefulBuilder(builder: (ctx, set) {
        void submit() => ctrl.text.trim().length < 2 ? set(() => error = 'Le nom est requis.') : popSheet(ctx, ctrl.text);
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          AppField(label: 'Nom', controller: ctrl, autofocus: true, error: error, maxLength: 80, textInputAction: TextInputAction.done, onSubmitted: (_) => submit()),
          const SizedBox(height: Insets.xl),
          AppButton('Enregistrer', onPressed: submit),
        ]);
      }));
    } finally {
      ctrl.dispose();
    }
    if (name == null || name.trim() == user.name) return;
    try {
      final r = await ref.read(apiProvider).patch('/auth/me', {'name': name.trim()}) as Map<String, dynamic>;
      await ref.read(sessionProvider.notifier).setUser(User.fromJson({...r, 'atelier': user.atelier?.raw}));
    } on ApiException catch (e) {
      if (context.mounted) toast(context, e.field('name') ?? e.message);
    }
  }

  Future<void> _becomeAtelier(BuildContext context, WidgetRef ref) async {
    if (!await confirm(context, title: 'Passer en compte couturier ?', message: 'Vous garderez vos favoris. L\'espace client reste accessible.', action: 'Continuer')) return;
    try {
      final r = await ref.read(apiProvider).post('/auth/devenir-atelier') as Map<String, dynamic>;
      await ref.read(sessionProvider.notifier).setUser(User.fromJson(r));
      if (context.mounted) context.go('/atelier/assistant');
    } on ApiException catch (e) {
      if (context.mounted) toast(context, e.message);
    }
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    if (!await confirm(context, title: 'Se déconnecter ?', message: 'Vos favoris et votre activité restent liés à votre compte.', action: 'Se déconnecter', danger: true)) return;
    try { await ref.read(apiProvider).post('/auth/logout'); } catch (_) {}
    clearCache();
    await ref.read(sessionProvider.notifier).clear();
    if (context.mounted) context.go('/client');
  }

}

const _storage = FlutterSecureStorage();

/// Bandeau J+3 : une relance par atelier contacté, rejetable, jamais deux fois.
class ReviewNudge extends ConsumerStatefulWidget {
  const ReviewNudge({super.key});
  @override
  ConsumerState<ReviewNudge> createState() => _ReviewNudgeState();
}

class _ReviewNudgeState extends ConsumerState<ReviewNudge> {
  Set<int>? _dismissed;
  int? _uid;

  String get _key => 'nudge_dismissed_$_uid';

  // Les rejets appartiennent au compte : un autre compte sur le même téléphone repart à zéro.
  void _load(int uid) {
    _uid = uid;
    _dismissed = null;
    _storage.read(key: _key).then((v) {
      if (mounted && _uid == uid) setState(() => _dismissed = (v ?? '').split(',').map(int.tryParse).nonNulls.toSet());
    });
  }

  Future<void> _dismiss(int atelierId) async {
    setState(() => _dismissed!.add(atelierId));
    await _storage.write(key: _key, value: _dismissed!.join(','));
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(userProvider);
    if (user == null) return const SizedBox.shrink();
    if (user.id != _uid) _load(user.id);
    if (_dismissed == null) return const SizedBox.shrink();
    final now = DateTime.now();
    final limit = now.subtract(const Duration(days: 3)), floor = now.subtract(const Duration(days: 30));
    return contactsProvider(ref).watch((items) {
      final contact = items?.where((c) => c.atelierId != null && c.myRating == null && c.at.isBefore(limit) && c.at.isAfter(floor) && !_dismissed!.contains(c.atelierId)).firstOrNull;
      if (contact == null) return const SizedBox.shrink();
      final id = contact.atelierId!;
      return Padding(
        padding: const EdgeInsets.fromLTRB(Insets.page, 0, Insets.page, Insets.lg),
        child: AppCard(padding: const EdgeInsets.fromLTRB(Insets.lg, Insets.sm, Insets.sm, Insets.md), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Padding(padding: const EdgeInsets.only(top: Insets.md), child: Text('Comment s\'est passé votre échange avec ${contact.atelierName} ?', style: context.text.titleMedium))),
            AppIconButton(icon: FIcons.x, label: 'Ignorer', onTap: () => _dismiss(id)),
          ]),
          Stars(0, size: 28, onChanged: (v) async {
            try {
              await ref.read(apiProvider).post('/avis', {'atelier_id': id, 'rating': v});
              invalidate(reviewStale);
              if (context.mounted) { toast(context, 'Merci pour votre avis.'); await _dismiss(id); }
            } on ApiException catch (e) {
              if (context.mounted) toast(context, e.message);
            }
          }),
        ])),
      );
    });
  }
}
