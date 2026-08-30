import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart' show FCircularProgress;
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../api.dart';
import '../../models.dart';
import '../../queries.dart';
import '../../session.dart';
import '../../ui.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileState();
}

class _ProfileState extends ConsumerState<ProfileScreen> {
  Atelier? _atelier;
  Object? _loadError;
  final _name = TextEditingController(), _desc = TextEditingController(), _phone = TextEditingController(), _address = TextEditingController();
  final _hours = TextEditingController(), _priceFrom = TextEditingController();
  final _tiktok = TextEditingController(), _instagram = TextEditingController(), _facebook = TextEditingController();
  String? _region, _logo, _cover, _registre;
  double? _lat, _lng;
  final _specs = <String>{};
  var _photos = <Map<String, dynamic>>[];
  bool _busy = false, _locating = false, _adding = false;
  String? _uploading, _snapshot;
  Map<String, String?> _errors = {};

  Api get _api => ref.read(apiProvider);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in [_name, _desc, _phone, _address, _hours, _priceFrom, _tiktok, _instagram, _facebook]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _atelier = null; _loadError = null; });
    try {
      final a = Atelier.fromJson((await _api.get('/mon-atelier') as Map).cast<String, dynamic>());
      _name.text = a.name;
      _desc.text = a.description ?? '';
      _phone.text = formatPhone(a.phone ?? '');
      _address.text = a.address ?? '';
      _hours.text = a.raw['hours'] as String? ?? '';
      _priceFrom.text = (a.raw['price_from'] as num?)?.toInt().toString() ?? '';
      _registre = a.raw['registre_commerce_path'];
      _tiktok.text = socialHandle(a.tiktok ?? '');
      _instagram.text = socialHandle(a.instagram ?? '');
      _facebook.text = socialHandle(a.facebook ?? '');
      _region = a.region;
      _logo = a.raw['logo_path'];
      _cover = a.raw['cover_path'];
      _lat = a.latitude;
      _lng = a.longitude;
      _specs..clear()..addAll(a.specialties);
      _photos = List.of(a.photoRows);
      setState(() { _atelier = a; _snapshot = jsonEncode(_body()); });
    } catch (e) {
      setState(() => _loadError = e);
    }
  }

  String? _text(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();

  Map<String, dynamic> _body() => {
    'name': _name.text.trim(), 'description': _text(_desc), 'phone': phoneE164(_phone.text), 'region': _region, 'address': _text(_address),
    'registre_commerce_path': _registre, 'hours': _text(_hours), 'price_from': int.tryParse(_priceFrom.text),
    'latitude': _lat, 'longitude': _lng, 'specialties': _specs.toList(),
    'logo_path': _logo, 'cover_path': _cover, 'tiktok': _text(_tiktok), 'instagram': _text(_instagram), 'facebook': _text(_facebook),
  };

  bool get _dirty => _snapshot != null && jsonEncode(_body()) != _snapshot;

  Future<void> _save() async {
    final phone = phoneError(_phone.text, required: false);
    final errors = {
      if (_name.text.trim().length < 2) 'name': 'Le nom est requis.',
      'phone': ?phone,
      if (_region == null) 'region': 'La région est obligatoire.',
      if (_specs.isEmpty) 'specialties': 'Choisissez au moins une spécialité.',
    };
    setState(() => _errors = errors);
    if (errors.isNotEmpty) return;
    setState(() => _busy = true);
    try {
      await _api.patch('/mon-atelier', _body());
      _snapshot = jsonEncode(_body());
      invalidate({'atelier', 'ateliers', 'ateliers-proches', 'ateliers-verifies', 'carte', 'ateliers-repli'});
      // Quitter avant de rafraîchir la session : le rafraîchissement du routeur remettrait l'écran en place.
      final session = ref.read(sessionProvider.notifier);
      if (!mounted) return;
      toast(context, 'Profil enregistré.');
      context.pop();
      session.setUser(User.fromJson(await _api.get('/auth/me')));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _errors = {for (final k in const ['name', 'description', 'phone', 'region', 'address', 'hours', 'price_from', 'specialties', 'tiktok', 'instagram', 'facebook']) k: e.field(k)});
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

  Future<void> _pickImage(String kind, String label) async {
    if (_uploading != null) return;
    final x = await pickPhoto(context, title: label);
    if (x == null) return;
    setState(() => _uploading = kind);
    try {
      final path = await _api.upload(File(x.path), kind);
      if (!mounted) return;
      setState(() => switch (kind) { 'logo' => _logo = path, 'registre' => _registre = path, _ => _cover = path });
      toast(context, 'Photo envoyée.');
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    } finally {
      if (mounted) setState(() => _uploading = null);
    }
  }

  Future<void> _addPhotos() async {
    final List<XFile> files;
    try {
      files = await ImagePicker().pickMultiImage(maxWidth: 1600, imageQuality: 85);
    } on PlatformException {
      if (mounted) toast(context, 'Galerie indisponible.');
      return;
    }
    if (files.isEmpty) return;
    setState(() => _adding = true);
    try {
      for (final x in files) {
        final path = await _api.upload(File(x.path), 'portfolio');
        final row = (await _api.post('/mon-atelier/portfolio', {'path': path}) as Map).cast<String, dynamic>();
        setState(() => _photos = [..._photos, row]);
      }
      invalidate({'atelier'});
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  Future<void> _removePhoto(Map<String, dynamic> photo) async {
    if (!await confirm(context, title: 'Supprimer cette photo ?', action: 'Supprimer', danger: true)) return;
    try {
      await _api.delete('/mon-atelier/portfolio/${photo['id']}');
      setState(() => _photos = _photos.where((p) => p['id'] != photo['id']).toList());
      invalidate({'atelier'});
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    }
  }

  Future<void> _reorder(int from, int to) async {
    final next = List.of(_photos);
    final moved = next.removeAt(from);
    next.insert(to > from ? to - 1 : to, moved);
    final before = _photos;
    setState(() => _photos = next);
    try {
      await _api.patch('/mon-atelier/portfolio', {'ids': next.map((p) => p['id']).toList()});
      invalidate({'atelier'});
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _photos = before);
      toast(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tones;
    final hint = context.text.bodySmall!.copyWith(color: t.inkSecondary);
    if (_loadError != null) return AppScaffold(title: 'Mon atelier', body: AppState.fromError(_loadError!, onRetry: _load));
    if (_atelier == null) return const AppScaffold(title: 'Mon atelier', body: AppSkeleton());
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) { if (!didPop) leaveForm(context, dirty: _dirty); },
      child: AppScaffold(
      title: 'Mon atelier',
      onBack: () => leaveForm(context, dirty: _dirty),
      bottom: AppButton('Enregistrer', loading: _busy, onPressed: _save),
      body: ListView(padding: const EdgeInsets.symmetric(horizontal: Insets.page), children: [
        _Section('Identité', children: [
          AppField(label: 'Nom de l\'atelier', controller: _name, error: _errors['name'], textInputAction: TextInputAction.next),
          const SizedBox(height: Insets.lg),
          AppField(label: 'Description', controller: _desc, maxLines: 4, error: _errors['description'], hint: 'Ce que vous faites, depuis quand, pour qui.'),
          const SizedBox(height: Insets.lg),
          AppPhoneField(controller: _phone, error: _errors['phone']),
        ]),
        const SizedBox(height: Insets.lg),
        _Section('Localisation', children: [
          const _Label('Région'),
          AppRow(
            leading: const Icon(FIcons.mapPin), title: _region ?? 'Choisir une région', trailing: Icon(FIcons.chevronsUpDown, color: t.inkTertiary),
            onTap: () async {
              final r = await pick(context, title: 'Région', options: regions, label: (r) => r, selected: _region);
              if (r != null) setState(() => _region = r);
            },
          ),
          if (_errors['region'] != null) _Error(_errors['region']!),
          const SizedBox(height: Insets.lg),
          AppField(label: 'Adresse (facultative)', controller: _address, hint: 'Quartier, rue, repère', error: _errors['address']),
          const SizedBox(height: Insets.xl),
          AppButton(_lat == null ? 'Utiliser ma position actuelle' : 'Position enregistrée', variant: AppButtonVariant.secondary,
            icon: _lat == null ? FIcons.locateFixed : FIcons.check, loading: _locating, onPressed: _locate),
          const SizedBox(height: Insets.sm),
          Text('Permet aux clients proches de vous trouver.', style: hint),
        ]),
        const SizedBox(height: Insets.lg),
        _Section('Vitrine', children: [
          const _Label('Spécialités'),
          AppChoice(options: specialties.keys.toList(), selected: _specs, label: (s) => specialties[s]!, multi: true,
            onChanged: (s) => setState(() => _specs.contains(s) ? _specs.remove(s) : _specs.add(s))),
          if (_errors['specialties'] != null) _Error(_errors['specialties']!),
          const SizedBox(height: Insets.xl),
          Row(crossAxisAlignment: CrossAxisAlignment.start, spacing: Insets.lg, children: [
            Expanded(child: _ImageWell(label: 'Logo', path: _logo, square: true, busy: _uploading == 'logo', onTap: () => _pickImage('logo', 'Logo'))),
            Expanded(flex: 2, child: _ImageWell(label: 'Photo de couverture', path: _cover, busy: _uploading == 'couverture', onTap: () => _pickImage('couverture', 'Photo de couverture'))),
          ]),
          const SizedBox(height: Insets.xl),
          AppField(label: 'Horaires', controller: _hours, hint: 'Lun-Sam, 9h-19h', maxLength: 120, error: _errors['hours']),
          const SizedBox(height: Insets.lg),
          AppField(label: 'À partir de', controller: _priceFrom, hint: 'Prix minimum d\'une pièce', keyboardType: TextInputType.number,
            formatters: AppField.digitsOnly, maxLength: 9, error: _errors['price_from'],
            suffix: Padding(padding: const EdgeInsets.only(right: Insets.md), child: Center(widthFactor: 1, child: Text('FCFA', style: context.text.bodyMedium!.copyWith(color: t.inkSecondary))))),
          const SizedBox(height: Insets.xl),
          _ImageWell(label: 'Photo du registre de commerce (facultatif)', path: _registre, busy: _uploading == 'registre', onTap: () => _pickImage('registre', 'Registre de commerce')),
        ]),
        const SizedBox(height: Insets.lg),
        _Section('Réseaux sociaux', children: [
          AppSocialField('tiktok', controller: _tiktok, error: _errors['tiktok'], textInputAction: TextInputAction.next),
          const SizedBox(height: Insets.lg),
          AppSocialField('instagram', controller: _instagram, error: _errors['instagram'], textInputAction: TextInputAction.next),
          const SizedBox(height: Insets.lg),
          AppSocialField('facebook', controller: _facebook, error: _errors['facebook']),
        ]),
        const SizedBox(height: Insets.lg),
        _Section('Portfolio', action: _adding ? null : 'Ajouter des photos', onAction: _addPhotos, children: [
          if (_adding) const SizedBox(height: 72 + Insets.lg, child: AppSkeleton(rows: 1, height: 72)),
          if (_photos.isEmpty && !_adding)
            Text('Vos réalisations, telles que les clients les verront.', style: context.text.bodyMedium!.copyWith(color: t.inkSecondary))
          else ...[
            Text('Appuyez longtemps sur une photo pour la déplacer.', style: hint),
            const SizedBox(height: Insets.sm),
            ReorderableListView(
              shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), buildDefaultDragHandles: false, onReorder: _reorder,
              children: [
                for (var i = 0; i < _photos.length; i++)
                  ReorderableDelayedDragStartListener(key: ValueKey(_photos[i]['id']), index: i, child: _PhotoRow(
                    url: (_photos[i]['thumb_url'] ?? _photos[i]['url']) as String? ?? mediaUrl(_photos[i]['path'] as String),
                    position: i + 1, onDelete: () => _removePhoto(_photos[i]),
                  )),
              ],
            ),
          ],
        ]),
        const SizedBox(height: Insets.xxl),
      ]),
    ));
  }
}

/// Carte de formulaire : légende puis champs. Une AppRow porte déjà son retrait, elle n'est pas re-décalée.
class _Section extends StatelessWidget {
  const _Section(this.title, {required this.children, this.action, this.onAction});
  final String title;
  final List<Widget> children;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => AppCard(padding: const EdgeInsets.symmetric(vertical: Insets.page), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Padding(padding: const EdgeInsets.fromLTRB(Insets.page, 0, Insets.page, Insets.lg), child: Row(children: [
      Expanded(child: Text(title, style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary))),
      if (action != null) AppButton(action!, onPressed: onAction, variant: AppButtonVariant.ghost, size: 44),
    ])),
    for (final c in children) c is AppRow ? c : Padding(padding: const EdgeInsets.symmetric(horizontal: Insets.page), child: c),
  ]));
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: Insets.sm),
    child: Text(text, style: context.text.bodySmall!.copyWith(color: context.tones.inkSecondary, fontWeight: FontWeight.w600)),
  );
}

class _Error extends StatelessWidget {
  const _Error(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: Insets.xs),
    child: Text(text, style: context.text.bodySmall!.copyWith(color: context.tones.danger)),
  );
}

class _ImageWell extends StatelessWidget {
  const _ImageWell({required this.label, required this.path, required this.onTap, this.square = false, this.busy = false});
  final String label;
  final String? path;
  final VoidCallback onTap;
  final bool square, busy;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    _Label(label),
    Semantics(button: true, label: busy ? 'Envoi en cours : $label' : path == null ? 'Ajouter : $label' : 'Remplacer : $label', child: GestureDetector(onTap: busy ? null : onTap, child: busy
      ? AspectRatio(aspectRatio: square ? 1 : 16 / 10, child: DecoratedBox(
          decoration: BoxDecoration(color: context.tones.sunken, borderRadius: Radii.container), child: const Center(child: FCircularProgress())))
      : path != null
      ? AppPhoto(mediaUrl(path!), aspectRatio: square ? 1 : 16 / 10)
      : AspectRatio(aspectRatio: square ? 1 : 16 / 10, child: DecoratedBox(
          decoration: BoxDecoration(color: context.tones.sunken, borderRadius: Radii.container),
          child: Icon(FIcons.plus, size: Insets.xxl, color: context.tones.inkTertiary))))),
  ]);
}

class _PhotoRow extends StatelessWidget {
  const _PhotoRow({required this.url, required this.position, required this.onDelete});
  final String url;
  final int position;
  final VoidCallback onDelete;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: Insets.sm),
    child: Row(children: [
      SizedBox(width: 72, child: AppPhoto(url, aspectRatio: 1, radius: Radii.control)),
      const SizedBox(width: Insets.lg),
      Expanded(child: Text('Photo $position', style: context.text.titleMedium)),
      Icon(FIcons.gripVertical, color: context.tones.inkTertiary),
      const SizedBox(width: Insets.sm),
      AppIconButton(icon: FIcons.trash2, label: 'Supprimer la photo $position', color: context.tones.danger, onTap: onDelete),
    ]),
  );
}
