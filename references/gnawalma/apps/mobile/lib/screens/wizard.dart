import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart' hide FThemeBuildContext;
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../api.dart';
import '../models.dart';
import '../session.dart';
import '../ui.dart';

/// Recharge le compte depuis le serveur pour que la garde de route voie l'atelier.
Future<void> refreshMe(WidgetRef ref) async {
  final me = await ref.read(apiProvider).get('/auth/me');
  await ref.read(sessionProvider.notifier).setUser(User.fromJson(me));
}

String _mediaUrl(String path) => mediaUrl(path);

// Questions 1-2 forment l'étape API 1, 3-4 l'étape 2, 5-7 l'étape 3.
int _apiStep(int question) => question <= 2 ? 1 : question <= 4 ? 2 : 3;

IconData _specIcon(String key) => switch (key) { 'homme' => FIcons.mars, 'femme' => FIcons.venus, _ => FIcons.baby };

class WizardScreen extends ConsumerStatefulWidget {
  const WizardScreen({super.key});
  @override
  ConsumerState<WizardScreen> createState() => _WizardState();
}

class _WizardState extends ConsumerState<WizardScreen> {
  late final Atelier? _atelier = ref.read(userProvider)?.atelier;
  late int _step = _initialStep();
  late final _name = TextEditingController(text: _atelier?.name ?? '');
  late final _phone = TextEditingController(text: formatPhone(_atelier?.phone ?? ref.read(userProvider)?.phone ?? ''));
  late final _address = TextEditingController(text: _atelier?.address ?? '');
  late final _tiktok = TextEditingController(text: socialHandle(_atelier?.tiktok ?? '')), _instagram = TextEditingController(text: socialHandle(_atelier?.instagram ?? '')), _facebook = TextEditingController(text: socialHandle(_atelier?.facebook ?? ''));
  late String? _region = _atelier?.region;
  late double? _lat = _atelier?.latitude, _lng = _atelier?.longitude;
  late final _specs = <String>{...?_atelier?.specialties};
  late String? _cover = _atelier?.raw['cover_path'];
  bool _busy = false, _locating = false;
  String? _error;

  Api get _api => ref.read(apiProvider);

  int _initialStep() {
    final a = _atelier;
    if (a == null || a.name.trim().isEmpty) return 1;
    if (a.region == null) return 2;
    if (a.specialties.isEmpty) return 3;
    if ((a.phone ?? ref.read(userProvider)?.phone ?? '').trim().isEmpty) return 4;
    return a.wizardStep >= 3 ? _last : 5;
  }

  static const _last = 8;

  @override
  void dispose() {
    for (final c in [_name, _phone, _address, _tiktok, _instagram, _facebook]) { c.dispose(); }
    super.dispose();
  }

  String? _validate(int step) => switch (step) {
    1 => _name.text.trim().length < 2 ? 'Le nom est requis.' : null,
    2 => _region == null ? 'La région est obligatoire.' : null,
    3 => _specs.isEmpty ? 'Choisissez au moins une spécialité.' : null,
    4 => phoneError(_phone.text),
    _ => null,
  };

  Map<String, dynamic> _fieldsFor(int step) => switch (step) {
    1 => {'name': _name.text.trim()},
    2 => {'region': _region},
    3 => {'specialties': _specs.toList()},
    4 => {'phone': phoneE164(_phone.text)},
    5 => {for (final e in {'tiktok': _tiktok, 'instagram': _instagram, 'facebook': _facebook}.entries) e.key: e.value.text.trim().isEmpty ? null : e.value.text.trim()},
    6 => {'cover_path': _cover},
    _ => {'address': _address.text.trim().isEmpty ? null : _address.text.trim(), 'latitude': _lat, 'longitude': _lng},
  };

  Future<void> _save(Map<String, dynamic> body, int step) async {
    body['wizard_step'] = _apiStep(step);
    final creating = _atelier == null && ref.read(userProvider)?.atelier == null;
    creating ? await _api.post('/mon-atelier', body) : await _api.patch('/mon-atelier', body);
    await refreshMe(ref);
  }

  Future<void> _next() async {
    final err = _validate(_step);
    if (err != null) return setState(() => _error = err);
    setState(() { _busy = true; _error = null; });
    try {
      await _save(_fieldsFor(_step), _step);
      if (mounted) setState(() { _step++; _busy = false; });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      toast(context, e.message);
    }
  }

  Future<void> _finish() async {
    setState(() => _busy = true);
    try {
      await _api.post('/mon-atelier/terminer');
      await refreshMe(ref);
      if (mounted) context.go('/atelier/commandes');
    } on ApiException catch (e) {
      if (!mounted) return;
      toast(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _locate() async {
    setState(() => _locating = true);
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.deniedForever) { await Geolocator.openAppSettings(); return; }
      final p = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 15)));
      setState(() { _lat = p.latitude; _lng = p.longitude; });
    } catch (_) {
      if (mounted) toast(context, 'Position indisponible. La région suffira.');
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _pickCover() async {
    final x = await pickPhoto(context, title: 'Photo de l\'atelier');
    if (x == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final path = await _api.upload(File(x.path), 'couverture');
      setState(() => _cover = path);
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  List<Widget> _content(BuildContext context) {
    final t = context.tones;
    final title = context.text.displayMedium;
    final hint = context.text.bodySmall!.copyWith(color: t.inkSecondary);
    return switch (_step) {
      1 => [
        Text('Comment s\'appelle votre atelier ?', style: title),
        const SizedBox(height: Insets.xxl),
        AppField(label: 'Nom de l\'atelier', controller: _name, autofocus: true, error: _error, textInputAction: TextInputAction.done, onSubmitted: (_) => _next()),
      ],
      2 => [
        Text('Dans quelle région ?', style: title),
        if (_error != null) ...[const SizedBox(height: Insets.sm), Text(_error!, style: hint.copyWith(color: t.danger))],
        const SizedBox(height: Insets.xxl),
        FSelectTileGroup<String>(
          control: FMultiValueControl.managedRadio(initial: _region, onChange: (v) => setState(() { _region = v.first; _error = null; })),
          children: [for (final r in regions) FSelectTile.suffix(title: Text(r), value: r)],
        ),
      ],
      3 => [
        Text('Vous cousez pour qui ?', style: title),
        if (_error != null) ...[const SizedBox(height: Insets.sm), Text(_error!, style: hint.copyWith(color: t.danger))],
        const SizedBox(height: Insets.xxl),
        FSelectTileGroup<String>(
          control: FMultiValueControl.managed(initial: _specs, onChange: (v) => setState(() { _specs..clear()..addAll(v); _error = null; })),
          children: [for (final e in specialties.entries) FSelectTile.suffix(prefix: Icon(_specIcon(e.key)), title: Text(e.value), value: e.key)],
        ),
      ],
      4 => [
        Text('Votre numéro WhatsApp', style: title),
        const SizedBox(height: Insets.xxl),
        AppPhoneField(controller: _phone, autofocus: true, error: _error, textInputAction: TextInputAction.done, onSubmitted: (_) => _next()),
      ],
      5 => [
        Text('Vos réseaux sociaux', style: title),
        const SizedBox(height: Insets.sm),
        Text('Facultatif. Les clients verront vos créations.', style: hint),
        const SizedBox(height: Insets.xxl),
        AppSocialField('tiktok', controller: _tiktok, textInputAction: TextInputAction.next),
        const SizedBox(height: Insets.lg),
        AppSocialField('instagram', controller: _instagram, textInputAction: TextInputAction.next),
        const SizedBox(height: Insets.lg),
        AppSocialField('facebook', controller: _facebook, textInputAction: TextInputAction.done, onSubmitted: (_) => _next()),
      ],
      6 => [
        Text('Une photo de votre atelier', style: title),
        const SizedBox(height: Insets.xxl),
        _CoverWell(url: _cover == null ? null : _mediaUrl(_cover!), onTap: _pickCover),
      ],
      _ => [
        Text('Où vous trouver ?', style: title),
        const SizedBox(height: Insets.sm),
        Text('Facultatif. Aide les clients proches à vous trouver.', style: hint),
        const SizedBox(height: Insets.xxl),
        AppField(label: 'Adresse (facultative)', controller: _address, hint: 'Quartier, rue, repère'),
        const SizedBox(height: Insets.lg),
        AppButton(_lat == null ? 'Utiliser ma position' : 'Position enregistrée', variant: AppButtonVariant.secondary,
          icon: _lat == null ? FIcons.locateFixed : FIcons.check, loading: _locating, onPressed: _locate),
      ],
    };
  }

  Widget? _bottom() => switch (_step) {
    1 || 2 || 3 || 4 => AppButton('Continuer', loading: _busy, onPressed: _next),
    5 || 6 || 7 => Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        AppButton('Continuer', loading: _busy, onPressed: _next),
        const SizedBox(height: Insets.sm),
        AppButton('Plus tard', variant: AppButtonVariant.ghost, onPressed: _busy ? null : () => setState(() { _step++; _error = null; })),
      ]),
    _last => AppButton('Ouvrir mon atelier', loading: _busy, onPressed: _finish),
    _ => null,
  };

  @override
  Widget build(BuildContext context) {
    final t = context.tones;
    return AppScaffold(
      onBack: _step > 1 ? () => setState(() => _step--) : null,
      bottom: _bottom(),
      body: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(Insets.page, Insets.sm, Insets.page, 0),
          child: Semantics(label: 'Étape $_step sur $_last', child: ClipRRect(borderRadius: Radii.full, child: SizedBox(height: 3, child: Stack(children: [
            ColoredBox(color: t.hairline, child: const SizedBox.expand()),
            AnimatedFractionallySizedBox(duration: Motion.base, curve: Curves.easeOutCubic, alignment: Alignment.centerLeft, widthFactor: _step / _last, child: ColoredBox(color: context.colors.onSurface, child: const SizedBox.expand())),
          ])))),
        ),
        Expanded(child: AnimatedSwitcher(
          duration: Motion.base,
          transitionBuilder: (child, anim) => FadeTransition(
            opacity: anim,
            child: SlideTransition(position: Tween<Offset>(begin: const Offset(0.06, 0), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)), child: child),
          ),
          child: _step == _last
            ? _FinalReview(key: const ValueKey(_last), cover: _cover, name: _name.text, region: _region ?? '', specs: _specs)
            : ListView(key: ValueKey(_step), padding: const EdgeInsets.symmetric(horizontal: Insets.page), children: [
                const SizedBox(height: Insets.xl),
                ..._content(context),
                const SizedBox(height: Insets.xxl),
              ]),
        )),
      ]),
    );
  }
}

class _CoverWell extends StatelessWidget {
  const _CoverWell({required this.url, required this.onTap});
  final String? url;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(button: true, label: url == null ? 'Ajouter une photo' : 'Changer la photo', child: GestureDetector(
    onTap: onTap,
    child: url != null
      ? AppPhoto(url, aspectRatio: 16 / 10)
      : AspectRatio(aspectRatio: 16 / 10, child: DecoratedBox(
          decoration: BoxDecoration(color: context.tones.sunken, borderRadius: Radii.container),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, spacing: Insets.md, children: [
            Icon(FIcons.camera, size: Insets.xxxl, color: context.tones.inkTertiary),
            Text('Appuyez pour ajouter une photo', style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary)),
          ]))),
  ));
}

class _FinalReview extends StatelessWidget {
  const _FinalReview({super.key, required this.cover, required this.name, required this.region, required this.specs});
  final String? cover;
  final String name, region;
  final Set<String> specs;
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.symmetric(horizontal: Insets.page), children: [
    const SizedBox(height: Insets.xxxl),
    Center(child: Icon(FIcons.partyPopper, size: 40, color: context.colors.onSurface)),
    const SizedBox(height: Insets.lg),
    Text('Tout est prêt', style: context.text.displayMedium, textAlign: TextAlign.center),
    const SizedBox(height: Insets.xxl),
    AppCard(padding: EdgeInsets.zero, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      AppPhoto(cover == null ? null : _mediaUrl(cover!), fallbackText: name, aspectRatio: 16 / 9),
      Padding(padding: const EdgeInsets.all(Insets.page), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(name, style: context.text.titleLarge),
        const SizedBox(height: Insets.xs),
        Text(region, style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary)),
        if (specs.isNotEmpty) ...[
          const SizedBox(height: Insets.md),
          Wrap(spacing: Insets.sm, runSpacing: Insets.sm, children: [for (final s in specs) AppTag(specialties[s] ?? s)]),
        ],
      ])),
    ])),
    const SizedBox(height: Insets.xxl),
  ]);
}
