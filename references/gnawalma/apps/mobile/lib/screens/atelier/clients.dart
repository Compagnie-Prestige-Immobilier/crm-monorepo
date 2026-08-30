import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_contacts/flutter_contacts.dart' as fc;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api.dart';
import '../../models.dart';
import '../../queries.dart';
import '../../ui.dart';

Pages<Client> clientsProvider(WidgetRef ref, {String q = ''}) => Pages(ref, ['clients', uid(ref), q],
    (api, page) => api.get('/mon-atelier/clients', query: {if (q.isNotEmpty) 'q': q, 'page': page, 'limit': 30}), decodeClient);
Res<Client> clientProvider(WidgetRef ref, int id) => Res.one(ref, ['client', uid(ref), id], (api) => api.get('/mon-atelier/clients/$id'), decodeClient);

/// Rapprochement avant création : un numéro déjà enregistré rend la fiche existante.
Future<Client?> findClientByPhone(WidgetRef ref, String phone) async {
  final digits = phoneDigits(phone);
  if (digits.isEmpty) return null;
  final found = await ref.read(apiProvider).page('/mon-atelier/clients', decodeClient, query: {'q': digits, 'limit': 20});
  return found.items.where((c) => phoneDigits(c.phone ?? '') == digits).firstOrNull;
}

const _gutter = EdgeInsets.symmetric(horizontal: Insets.page);

class ClientsScreen extends ConsumerStatefulWidget {
  const ClientsScreen({super.key});
  @override
  ConsumerState<ClientsScreen> createState() => _ClientsState();
}

class _ClientsState extends ConsumerState<ClientsScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  String _q = '';
  bool _searching = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _toggleSearch() {
    _debounce?.cancel();
    _searchCtrl.clear();
    setState(() { _searching = !_searching; _q = ''; });
  }

  void _onSearchChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () { if (mounted) setState(() => _q = v.trim()); });
  }

  @override
  Widget build(BuildContext context) {
    // La recherche est faite par le serveur : chaque terme est sa propre liste paginée.
    final clients = clientsProvider(ref, q: _q);
    return AppScaffold(
      actions: [
        AppIconButton(icon: _searching ? FIcons.x : FIcons.search, label: 'Rechercher', onTap: _toggleSearch),
        AppIconButton(icon: FIcons.userPlus, label: 'Nouveau client', onTap: () => context.push('/atelier/clients/nouveau')),
      ],
      onRefresh: clients.refetch,
      body: Column(children: [
        if (_searching) Padding(padding: const EdgeInsets.fromLTRB(Insets.page, 0, Insets.page, Insets.lg), child: AppField(label: 'Rechercher', hint: 'Nom ou téléphone', controller: _searchCtrl, autofocus: true, onChanged: _onSearchChanged))
        else const _Headline('Vos clients', caption: 'Activité la plus récente en tête'),
        Expanded(child: PagedList(clients,
          card: true,
          padding: const EdgeInsets.only(bottom: Insets.xxl),
          empty: AppState(kind: AppStateKind.empty, title: _q.isEmpty ? 'Aucun client' : 'Aucun résultat', message: _q.isEmpty ? 'Ajoutez vos clients depuis vos contacts.' : null, actionLabel: _q.isEmpty ? 'Ajouter un client' : null, onAction: () => context.push('/atelier/clients/nouveau')),
          item: (c) => AppRow(leading: AppAvatar(name: c.name), title: c.name, subtitle: c.phone == null ? null : prettyPhone(c.phone!), onTap: () => context.push('/atelier/clients/${c.id}'),
            trailing: c.lastOrderAt == null ? null : Text(DateFormat('d MMM', 'fr').format(c.lastOrderAt!), style: context.text.bodySmall!.copyWith(color: context.tones.inkSecondary))),
        )),
      ]),
    );
  }
}

class _Headline extends StatelessWidget {
  const _Headline(this.title, {required this.caption});
  final String title, caption;
  @override
  Widget build(BuildContext context) => Column(children: [
    AppTitle(title, centered: true),
    // Remonte la légende sous le titre sans toucher au retrait d'AppTitle.
    Transform.translate(offset: const Offset(0, -Insets.lg), child: Text(caption, style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary))),
  ]);
}

class ClientScreen extends ConsumerWidget {
  const ClientScreen(this.id, {super.key});
  final int id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final client = clientProvider(ref, id);
    return Remote(client, page: true, skeleton: const AppSkeleton(rows: 4, height: 96), builder: (c) {
      final muted = context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary);
      final details = [c.address, c.notes].whereType<String>().join('\n');
      return AppScaffold(
        actions: [
          AppIconButton(icon: FIcons.pencil, label: 'Modifier', onTap: () => context.push('/atelier/clients/$id/modifier')),
          AppIconButton(icon: FIcons.plus, label: 'Nouvelle commande', onTap: () => context.push('/atelier/commandes/nouvelle?client=$id')),
        ],
        onRefresh: client.refetch,
        body: ListView(children: [
          const SizedBox(height: Insets.lg),
          Center(child: AppAvatar(name: c.name, size: 72)),
          const SizedBox(height: Insets.lg),
          Padding(padding: _gutter, child: Text(c.name, style: context.text.headlineMedium, textAlign: TextAlign.center)),
          if (details.isNotEmpty) Padding(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.sm, Insets.page, 0), child: Text(details, style: muted, textAlign: TextAlign.center)),
          const SizedBox(height: Insets.xl),
          Padding(padding: _gutter, child: Row(spacing: Insets.md, children: [
            Expanded(child: AppStatCard(label: 'Total dépensé', value: AppMoney(c.totalSpentCfa, style: AppText.moneyLg, short: true))),
            Expanded(child: AppStatCard(label: 'Reste à payer', value: AppMoney(c.remainingCfa, style: AppText.moneyLg, short: true))),
          ])),
          if (c.phone != null) ...[
            const SizedBox(height: Insets.lg),
            Padding(padding: _gutter, child: AppCard.rows([
              AppRow(leading: const Icon(FIcons.phone), title: 'Appeler', subtitle: prettyPhone(c.phone!), onTap: () => launchUrl(Uri.parse('tel:${c.phone}'))),
              AppRow(leading: const Icon(FIcons.messageCircle), title: 'WhatsApp', onTap: () => launchUrl(Uri.parse('https://wa.me/${c.phone!.replaceAll('+', '')}'), mode: LaunchMode.externalApplication)),
            ])),
          ],
          AppSection('Bénéficiaires', action: 'Ajouter', onAction: () => context.push('/atelier/clients/$id/beneficiaires/nouveau')),
          Padding(padding: _gutter, child: c.beneficiaries.isEmpty
            ? AppCard(padding: const EdgeInsets.all(Insets.page), child: Text('Les personnes pour qui ce client commande.', style: muted))
            : AppCard.rows([
                for (final b in c.beneficiaries)
                  AppRow(leading: AppAvatar(name: b.label), title: b.label, subtitle: b.measurements ?? 'Pas encore de mesures', trailing: AppTag(specialties[b.gender] ?? b.gender),
                    onTap: () => context.push('/atelier/clients/$id/beneficiaires/${b.id}')),
              ])),
          const AppSection('Commandes'),
          Padding(padding: _gutter, child: c.orders.isEmpty
            ? AppCard(padding: const EdgeInsets.all(Insets.page), child: Text('Aucune commande.', style: muted))
            : AppCard.rows([
                for (final o in c.orders)
                  AppRow(title: o.description?.isNotEmpty == true ? o.description! : o.reference, subtitle: DateFormat('d MMM yyyy', 'fr').format(o.dueAt), onTap: () => context.push('/atelier/commandes/${o.id}'),
                    trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, spacing: Insets.xs, children: [AppMoney(o.remainingCfa, short: true), AppTag(orderStatuses[o.status] ?? o.status)])),
              ])),
          const SizedBox(height: Insets.xl),
          Padding(padding: _gutter, child: AppCard.rows([
            AppRow(leading: Icon(FIcons.trash2, color: context.tones.danger), title: 'Supprimer ce client', danger: true, trailing: const SizedBox.shrink(), onTap: () => _deleteClient(context, ref, c)),
          ])),
          const SizedBox(height: Insets.xxl),
        ]),
      );
    });
  }

  Future<void> _deleteClient(BuildContext context, WidgetRef ref, Client c) async {
    if (!await confirm(context, title: 'Supprimer ${c.name} ?', message: 'Sa fiche, ses bénéficiaires et son historique seront perdus.', action: 'Supprimer', danger: true)) return;
    try {
      await ref.read(apiProvider).delete('/mon-atelier/clients/${c.id}');
      invalidate({'clients', 'client'});
      if (!context.mounted) return;
      toast(context, 'Client supprimé.');
      context.pop();
    } on ApiException catch (e) {
      if (context.mounted) toast(context, e.message);
    }
  }
}

class _FormCard extends StatelessWidget {
  const _FormCard({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => AppCard(padding: const EdgeInsets.all(Insets.page), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children));
}

class ClientFormScreen extends ConsumerStatefulWidget {
  const ClientFormScreen({super.key, this.id});
  final int? id;
  @override
  ConsumerState<ClientFormScreen> createState() => _ClientFormState();
}

class _ClientFormState extends ConsumerState<ClientFormScreen> {
  final _name = TextEditingController(), _phone = TextEditingController(), _address = TextEditingController(), _notes = TextEditingController();
  bool _busy = false, _loaded = false, _contactsDenied = false;
  String _snapshot = '';
  String? _error, _phoneError;

  @override
  void initState() {
    super.initState();
    _snapshot = jsonEncode(_body());
    if (widget.id == null) WidgetsBinding.instance.addPostFrameCallback((_) => _fromContacts());
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _address, _notes]) { c.dispose(); }
    super.dispose();
  }

  Map<String, dynamic> _body() => {
    'name': _name.text.trim(), 'phone': phoneE164(_phone.text),
    'address': _address.text.trim().isEmpty ? null : _address.text.trim(), 'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
  };

  bool get _dirty => jsonEncode(_body()) != _snapshot;

  Future<void> _fromContacts() async {
    final c = await ContactsPicker.pick(context);
    if (c == null) { if (mounted && !ContactsPicker.granted) setState(() => _contactsDenied = true); return; }
    // Un numéro déjà enregistré ouvre la fiche existante au lieu d'en créer une seconde.
    final known = await findClientByPhone(ref, c.$2);
    if (!mounted) return;
    if (known != null) return context.pushReplacement('/atelier/clients/${known.id}');
    setState(() { _name.text = c.$1; _phone.text = formatPhone(c.$2); });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.id == null || _loaded) return _form(context);
    return Remote(clientProvider(ref, widget.id!), page: true, skeleton: const AppSkeleton(rows: 4), builder: (c) {
      _name.text = c.name; _phone.text = formatPhone(c.phone ?? ''); _address.text = c.address ?? ''; _notes.text = c.notes ?? ''; _loaded = true;
      _snapshot = jsonEncode(_body());
      return _form(context);
    });
  }

  Widget _form(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) { if (!didPop) leaveForm(context, dirty: _dirty); },
      child: AppScaffold(
      title: widget.id == null ? 'Nouveau client' : 'Modifier',
      onBack: () => leaveForm(context, dirty: _dirty),
      bottom: AppButton('Enregistrer', loading: _busy, onPressed: _save),
      body: ListView(padding: _gutter, children: [
        if (widget.id == null) ...[
          AppButton('Choisir dans mes contacts', icon: FIcons.contact, variant: AppButtonVariant.secondary, onPressed: _fromContacts),
          if (_contactsDenied) Padding(padding: const EdgeInsets.only(top: Insets.sm), child: Text('Accès aux contacts refusé. Autorisez-le dans les réglages du téléphone pour l\'utiliser.', style: context.text.bodySmall!.copyWith(color: context.tones.inkSecondary))),
          const SizedBox(height: Insets.xl),
        ],
        _FormCard(children: [
          AppField(label: 'Nom complet', controller: _name, error: _error, textInputAction: TextInputAction.next),
          const SizedBox(height: Insets.lg),
          AppPhoneField(controller: _phone, error: _phoneError, textInputAction: TextInputAction.next),
          const SizedBox(height: Insets.lg),
          AppField(label: 'Adresse', controller: _address, textInputAction: TextInputAction.next),
          const SizedBox(height: Insets.lg),
          AppField(label: 'Notes', controller: _notes, maxLines: 3, hint: 'Préférences, habitudes, remarques'),
        ]),
        const SizedBox(height: Insets.xxl),
      ]),
    ));
  }

  Future<void> _save() async {
    setState(() {
      _error = _name.text.trim().length < 2 ? 'Le nom est requis.' : null;
      _phoneError = phoneError(_phone.text, required: false);
    });
    if (_error != null || _phoneError != null) return;
    setState(() => _busy = true);
    final body = _body();
    try {
      final api = ref.read(apiProvider);
      final r = widget.id == null ? await api.post('/mon-atelier/clients', body) : await api.patch('/mon-atelier/clients/${widget.id}', body);
      invalidate({'clients', 'client'});
      if (!mounted) return;
      _snapshot = jsonEncode(body);
      if (widget.id == null) { toast(context, 'Client ajouté.'); return context.pushReplacement('/atelier/clients/${r['id']}'); }
      toast(context, 'Modifications enregistrées.');
      context.pop();
    } on ApiException catch (e) {
      if (mounted) { toast(context, e.message); setState(() => _busy = false); }
    }
  }
}

/// Liste maison du répertoire, jamais le sélecteur natif.
abstract final class ContactsPicker {
  static bool granted = true;

  static Future<(String, String)?> pick(BuildContext context) async {
    final status = await fc.FlutterContacts.permissions.request(fc.PermissionType.read);
    granted = status == fc.PermissionStatus.granted || status == fc.PermissionStatus.limited;
    if (!granted || !context.mounted) return null;
    final future = fc.FlutterContacts.getAll(properties: {fc.ContactProperty.name, fc.ContactProperty.phone})
        .then((list) => list.where((c) => c.phones.isNotEmpty).toList());
    return showAppSheet<(String, String)>(context, title: 'Mes contacts', child: _ContactsList(future));
  }

  static Future<Client?> open(BuildContext context, WidgetRef ref) async {
    final c = await pick(context);
    if (c == null) return null;
    try {
      final known = await findClientByPhone(ref, c.$2);
      if (known != null) return known;
      // Un contact étranger part tel quel : l'API tranche.
      final client = Client.fromJson(await ref.read(apiProvider).post('/mon-atelier/clients', {'name': c.$1, 'phone': phoneError(c.$2) == null ? phoneE164(c.$2) : c.$2}));
      invalidate({'clients'});
      return client;
    } on ApiException catch (e) {
      if (context.mounted) toast(context, e.message);
      return null;
    }
  }
}

class _ContactsList extends StatefulWidget {
  const _ContactsList(this.future);
  final Future<List<fc.Contact>> future;
  @override
  State<_ContactsList> createState() => _ContactsListState();
}

class _ContactsListState extends State<_ContactsList> {
  List<fc.Contact>? _contacts;
  String _q = '';

  @override
  void initState() {
    super.initState();
    widget.future.then((c) { if (mounted) setState(() => _contacts = c); });
  }

  @override
  Widget build(BuildContext context) {
    final all = _contacts;
    return SizedBox(height: MediaQuery.sizeOf(context).height * .7, child: Column(children: [
      AppField(label: 'Rechercher', hint: 'Nom', autofocus: true, onChanged: (v) => setState(() => _q = v.toLowerCase())),
      const SizedBox(height: Insets.md),
      Expanded(child: all == null ? const AppSkeleton(rows: 5) : _list(all)),
    ]));
  }

  Widget _list(List<fc.Contact> all) {
    final list = all.where((c) => (c.displayName ?? '').toLowerCase().contains(_q)).toList();
    return ListView.separated(itemCount: list.length, separatorBuilder: (_, _) => const AppDivider(inset: false),
      itemBuilder: (_, i) {
        final name = list[i].displayName ?? '', phone = list[i].phones.first.number;
        return AppRow(leading: AppAvatar(name: name), title: name, subtitle: phone, onTap: () => popSheet(context, (name, phone)));
      });
  }
}

class BeneficiaryFormScreen extends ConsumerStatefulWidget {
  const BeneficiaryFormScreen({super.key, required this.clientId, this.id});
  final int clientId;
  final int? id;
  @override
  ConsumerState<BeneficiaryFormScreen> createState() => _BeneficiaryFormState();
}

class _BeneficiaryFormState extends ConsumerState<BeneficiaryFormScreen> {
  final _label = TextEditingController(), _measurements = TextEditingController();
  String _gender = 'femme';
  bool _busy = false, _loaded = false;
  String _snapshot = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    _snapshot = jsonEncode(_body());
  }

  @override
  void dispose() {
    _label.dispose();
    _measurements.dispose();
    super.dispose();
  }

  Map<String, dynamic> _body() => {'label': _label.text.trim(), 'gender': _gender, 'measurements': _measurements.text.trim()};
  bool get _dirty => jsonEncode(_body()) != _snapshot;

  @override
  Widget build(BuildContext context) {
    if (widget.id == null || _loaded) return _form(context);
    return Remote(clientProvider(ref, widget.clientId), page: true, skeleton: const AppSkeleton(rows: 3), builder: (c) {
      final b = c.beneficiaries.where((b) => b.id == widget.id).firstOrNull;
      if (b == null) return AppScaffold(body: AppState(kind: AppStateKind.empty, title: 'Bénéficiaire introuvable', actionLabel: 'Retour', onAction: () => context.pop()));
      _label.text = b.label; _gender = b.gender; _measurements.text = b.measurements ?? ''; _loaded = true;
      _snapshot = jsonEncode(_body());
      return _form(context);
    });
  }

  Widget _form(BuildContext context) {
    final hint = context.text.bodySmall!.copyWith(color: context.tones.inkSecondary);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) { if (!didPop) leaveForm(context, dirty: _dirty); },
      child: AppScaffold(
      title: widget.id == null ? 'Nouveau bénéficiaire' : 'Modifier',
      onBack: () => leaveForm(context, dirty: _dirty),
      bottom: AppButton('Enregistrer', loading: _busy, onPressed: _save),
      body: ListView(padding: _gutter, children: [
        _FormCard(children: [
          AppField(label: 'Qui est-ce ?', controller: _label, hint: 'Awa, mon fils, moi-même', error: _error),
          const SizedBox(height: Insets.xl),
          Text('Genre', style: hint.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: Insets.sm),
          AppChoice(options: specialties.keys.toList(), selected: {_gender}, label: (g) => specialties[g]!, onChanged: (g) => setState(() => _gender = g)),
          const SizedBox(height: Insets.xl),
          AppField(label: 'Mesures', controller: _measurements, hint: '48 / 108 / 90 / 63 / 42 / 96 / 92 / 104 / 60 / 105', maxLines: 4),
          const SizedBox(height: Insets.sm),
          Text('Écrivez-les comme dans votre cahier. Modifier remplace les anciennes ; les commandes déjà créées gardent les leurs.', style: hint),
        ]),
        if (widget.id != null) ...[
          const SizedBox(height: Insets.lg),
          AppCard.rows([
            AppRow(leading: Icon(FIcons.trash2, color: context.tones.danger), title: 'Supprimer', danger: true, trailing: const SizedBox.shrink(), onTap: _delete),
          ]),
        ],
        const SizedBox(height: Insets.xxl),
      ]),
    ));
  }

  Future<void> _delete() async {
    if (!await confirm(context, title: 'Supprimer ce bénéficiaire ?', message: 'Les commandes déjà créées gardent leurs mesures.', action: 'Supprimer', danger: true)) return;
    try {
      await ref.read(apiProvider).delete('/mon-atelier/beneficiaires/${widget.id}');
      invalidate({'clients', 'client'});
      if (!mounted) return;
      toast(context, 'Bénéficiaire supprimé.');
      context.pop();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    }
  }

  Future<void> _save() async {
    if (_label.text.trim().isEmpty) return setState(() => _error = 'Indiquez qui est cette personne.');
    setState(() { _busy = true; _error = null; });
    final body = _body();
    try {
      final api = ref.read(apiProvider);
      widget.id == null ? await api.post('/mon-atelier/clients/${widget.clientId}/beneficiaires', body) : await api.patch('/mon-atelier/beneficiaires/${widget.id}', body);
      invalidate({'client'});
      if (!mounted) return;
      _snapshot = jsonEncode(body);
      if (widget.id != null) toast(context, 'Modifications enregistrées.');
      context.pop();
    } on ApiException catch (e) {
      if (mounted) { toast(context, e.message); setState(() => _busy = false); }
    }
  }
}
