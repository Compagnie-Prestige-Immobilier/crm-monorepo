import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api.dart';
import '../../models.dart';
import '../../queries.dart';
import '../../session.dart';
import '../../ui.dart';
import 'orders.dart' show dueTodayProvider, ordersFilterProvider, OrdersView;

Res<Json> dashboardProvider(WidgetRef ref) => Res.one(ref, ['tableau', uid(ref)], (api) => api.get('/mon-atelier/tableau'), (j) => j);
Pages<Contact> requestsProvider(WidgetRef ref) => Pages(ref, ['demandes', uid(ref)], (api, page) => api.get('/mon-atelier/demandes', query: {'page': page, 'limit': 30}), Contact.fromJson);

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final board = dashboardProvider(ref);
    return AppScaffold(
      onRefresh: board.refetch,
      body: Column(children: [
        _Greeting(ref.watch(userProvider)),
        Expanded(child: Remote(board, skeleton: const AppSkeleton(rows: 4, height: 96), builder: (d) {
          final unpaid = (d['unpaid_cfa'] as num?)?.toInt() ?? 0;
          final overdue = (d['overdue_orders'] as num?)?.toInt() ?? 0;
          final active = (d['active_orders'] as num?)?.toInt() ?? 0;
          final pending = (d['pending_requests'] as num?)?.toInt() ?? 0;
          final nextDue = d['next_due_at'] == null ? null : DateTime.tryParse(d['next_due_at'].toString())?.toLocal();
          final delivered = (d['delivered_month'] as num?)?.toInt() ?? 0;
          final paidMonth = (d['paid_month_cfa'] as num?)?.toInt() ?? 0;
          final t = context.tones;
          final big = context.text.displayLarge!;
          void orders(OrdersView view) { ref.read(ordersFilterProvider.notifier).set(view); context.go('/atelier/commandes'); }
          return ListView(padding: const EdgeInsets.fromLTRB(Insets.page, 0, Insets.page, Insets.xxl), children: [
            AppKeyTile(label: 'Reste à payer', value: AppMoney(unpaid, style: AppText.moneyXl), onTap: () => orders(OrdersView.impayees)),
            const SizedBox(height: Insets.lg),
            Row(spacing: Insets.lg, children: [
              Expanded(child: AppStatCard(label: 'En retard', value: Text('$overdue', style: big.copyWith(color: overdue > 0 ? t.danger : null)), onTap: () => orders(OrdersView.retard))),
              Expanded(child: AppStatCard(label: 'En cours', value: Text('$active', style: big), onTap: () => orders(OrdersView.enCours))),
            ]),
            const SizedBox(height: Insets.lg),
            _DueToday(d['due_today'] as num?),
            const SizedBox(height: Insets.lg),
            AppStatCard(label: 'Prochaine échéance', value: Text(nextDue == null ? 'Aucune' : relativeDue(nextDue)), onTap: () => orders(OrdersView.enCours)),
            const SizedBox(height: Insets.lg),
            AppCard.rows([
              AppRow(
                title: 'Ce mois-ci', subtitle: '$delivered commande${delivered > 1 ? 's' : ''} livrée${delivered > 1 ? 's' : ''} · ${formatCfa(paidMonth)} encaissés',
                leading: const Icon(FIcons.packageCheck),
                trailing: Icon(FIcons.chevronRight, color: t.inkTertiary),
                onTap: () => orders(OrdersView.mois),
              ),
              AppRow(
                title: 'Reste à payer par client', subtitle: 'Les impayés regroupés par client',
                leading: const Icon(FIcons.users),
                onTap: () => context.push('/atelier/commandes/impayes'),
              ),
            ]),
            const SizedBox(height: Insets.lg),
            AppCard.rows([
              AppRow(
                title: 'Demandes reçues', subtitle: pending == 0 ? 'Aucune demande en attente' : null,
                leading: const Icon(FIcons.inbox),
                onTap: () => context.push('/atelier/tableau/demandes'),
                trailing: pending == 0 ? null : Row(mainAxisSize: MainAxisSize.min, spacing: Insets.sm, children: [
                  AppTag('$pending', tone: AppTone.warning),
                  Icon(FIcons.chevronRight, color: t.inkTertiary),
                ]),
              ),
            ]),
          ]);
        })),
      ]),
    );
  }
}

/// Compteur du jour : la valeur du tableau si l'API la donne, sinon la première page des échéances du jour.
class _DueToday extends ConsumerWidget {
  const _DueToday(this.count);
  final num? count;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Widget tile(String value) => AppStatCard(
      label: 'À livrer aujourd\'hui', value: Text(value, style: context.text.displayLarge),
      onTap: () { ref.read(ordersFilterProvider.notifier).set(OrdersView.aujourdhui); context.go('/atelier/commandes'); },
    );
    if (count != null) return tile('${count!.toInt()}');
    return dueTodayProvider(ref).watch((list, _) => tile(list == null ? '…' : '${list.length}'));
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting(this.user);
  final User? user;
  @override
  Widget build(BuildContext context) {
    final first = user?.name.trim().split(RegExp(r'\s+')).first ?? '';
    final atelier = user?.atelier?.name;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Insets.page, Insets.sm, Insets.page, Insets.xl),
      child: Column(children: [
        Text(first.isEmpty ? 'Bonjour' : 'Bonjour, $first', style: context.text.headlineMedium!.copyWith(fontWeight: FontWeight.w700), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
        if (atelier != null) ...[
          const SizedBox(height: Insets.xs),
          Text(atelier, style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ]),
    );
  }
}

class RequestsScreen extends ConsumerWidget {
  const RequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requests = requestsProvider(ref);
    return AppScaffold(
      title: 'Demandes reçues',
      onRefresh: requests.refetch,
      body: PagedList(requests,
        card: true,
        padding: const EdgeInsets.only(bottom: Insets.xxl),
        empty: const AppState(kind: AppStateKind.empty, title: 'Aucune demande', message: 'Les demandes arrivent ici quand un client vous contacte depuis la marketplace.'),
        item: _RequestRow.new,
      ),
    );
  }
}

class _RequestRow extends ConsumerWidget {
  const _RequestRow(this.c);
  final Contact c;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = c.userName.isEmpty ? 'Client' : c.userName;
    final meta = [c.userPhone ?? 'Numéro inconnu', if (c.region != null) c.region!].join(' · ');
    return AppRow(
      leading: AppAvatar(name: name),
      title: name,
      subtitle: c.message?.isNotEmpty == true ? '$meta\n${c.message}' : meta,
      onTap: () => _open(context, ref),
      trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
        Text(DateFormat('d MMM', 'fr').format(c.at), style: context.text.bodySmall!.copyWith(color: context.tones.inkSecondary)),
        if (c.handled) ...[const SizedBox(height: Insets.xs), const AppTag('Traitée', tone: AppTone.success)],
      ]),
    );
  }

  void _open(BuildContext context, WidgetRef ref) {
    final nameCtrl = TextEditingController(text: c.userName);
    var busy = false, done = false;
    String? nameError;
    askSheet<bool>(context, title: c.userName.isEmpty ? 'Demande' : c.userName,
      dirty: () => !done && nameCtrl.text.trim() != c.userName.trim(),
      child: StatefulBuilder(builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(c.userPhone ?? 'Numéro inconnu', style: ctx.text.titleMedium),
        Text([DateFormat('d MMMM yyyy', 'fr').format(c.at), if (c.region != null) c.region!].join(' · '), style: ctx.text.bodyMedium!.copyWith(color: ctx.tones.inkSecondary)),
        if (c.message?.isNotEmpty == true) ...[const SizedBox(height: Insets.lg), Text(c.message!, style: ctx.text.bodyLarge)],
        const SizedBox(height: Insets.xl),
        // Une demande sans nom ne doit pas créer un client « Client » : on le demande ici.
        if (c.userName.isEmpty) ...[
          AppField(label: 'Nom du client', controller: nameCtrl, error: nameError, autofocus: true),
          const SizedBox(height: Insets.lg),
        ],
        if (c.userPhone case final phone?) ...[
          Row(children: [
            Expanded(child: AppButton('Appeler', icon: FIcons.phone, variant: AppButtonVariant.secondary, onPressed: () => launchUrl(Uri.parse('tel:$phone')))),
            const SizedBox(width: Insets.md),
            Expanded(child: AppButton('WhatsApp', icon: FIcons.messageCircle, variant: AppButtonVariant.secondary, onPressed: () => openWhatsApp(phone))),
          ]),
          const SizedBox(height: Insets.sm),
        ],
        AppButton('Créer une commande', loading: busy, onPressed: () async {
          if (busy) return;
          if (nameCtrl.text.trim().length < 2) return set(() => nameError = 'Indiquez le nom du client.');
          set(() { busy = true; nameError = null; });
          done = await _createOrder(context, ref, nameCtrl.text.trim());
          if (!done && ctx.mounted) set(() => busy = false);
        }),
        if (!c.handled) ...[
          const SizedBox(height: Insets.sm),
          AppButton('Marquer traitée', variant: AppButtonVariant.ghost, loading: busy, onPressed: () async {
            if (busy) return;
            set(() => busy = true);
            done = await _markHandled(context, ref);
            if (!done && ctx.mounted) set(() => busy = false);
          }),
        ],
      ]))).whenComplete(nameCtrl.dispose);
  }

  Future<bool> _createOrder(BuildContext context, WidgetRef ref, String name) async {
    final api = ref.read(apiProvider);
    final phone = c.userPhone, digits = phoneDigits(c.userPhone ?? '');
    try {
      // Recherche serveur avant création : le même numéro ou le même nom ne doit pas doublonner une fiche.
      final found = await api.page('/mon-atelier/clients', decodeClient, query: {'q': digits.isNotEmpty ? digits : name, 'limit': 20});
      var client = found.items.where((k) => (digits.isNotEmpty && phoneDigits(k.phone ?? '') == digits) || foldAccents(k.name.trim()) == foldAccents(name)).firstOrNull;
      if (client == null) {
        client = Client.fromJson(await api.post('/mon-atelier/clients', {'name': name, 'phone': phone}));
        invalidate({'clients'});
      }
      if (!c.handled) await ref.read(apiProvider).patch('/mon-atelier/demandes/${c.id}');
      invalidate({'demandes', 'tableau'});
      if (!context.mounted) return true;
      popSheet(context);
      context.push('/atelier/commandes/nouvelle?client=${client.id}');
      return true;
    } on ApiException catch (e) {
      if (context.mounted) toast(context, e.message);
      return false;
    }
  }

  Future<bool> _markHandled(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(apiProvider).patch('/mon-atelier/demandes/${c.id}');
      invalidate({'demandes', 'tableau'});
      if (!context.mounted) return true;
      popSheet(context);
      toast(context, 'Demande marquée traitée.');
      return true;
    } on ApiException catch (e) {
      if (context.mounted) toast(context, e.message);
      return false;
    }
  }
}
