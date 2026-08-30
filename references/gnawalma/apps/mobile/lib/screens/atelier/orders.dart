import 'dart:async';
import 'dart:io';
import 'dart:math' show pi;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart' show FCircularProgress, FCircularProgressSizeVariant, FTappable;
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:just_audio/just_audio.dart' show AudioPlayer, ProcessingState;
import 'package:path_provider/path_provider.dart' show getTemporaryDirectory;
import 'package:record/record.dart' show Amplitude, AudioEncoder, AudioRecorder, RecordConfig;
import 'package:url_launcher/url_launcher.dart';

import '../../api.dart';
import '../../models.dart';
import '../../notifications.dart';
import '../../queries.dart';
import '../../session.dart';
import '../../ui.dart';
import 'clients.dart' show clientsProvider, clientProvider, findClientByPhone, ContactsPicker;
import 'dashboard.dart' show dashboardProvider;

Pages<Order> ordersProvider(WidgetRef ref, String? status, {bool unpaid = false, bool overdue = false, bool dueToday = false, String q = '', String? sort}) =>
    Pages(ref, ['commandes', uid(ref), status, unpaid, overdue, dueToday, q, sort],
    (api, page) => api.get('/mon-atelier/commandes', query: {
      'status': ?status, if (unpaid) 'impayees': 1, if (overdue) 'en_retard': 1, if (dueToday) 'echeance': 'aujourdhui',
      if (q.isNotEmpty) 'q': q, 'sort': ?sort, 'page': page, 'limit': 30,
    }), decodeOrder);
Res<List<Order>> dueTodayProvider(WidgetRef ref) => Res.page(ref, ['commandes', uid(ref), 'aujourdhui'],
    (api) => api.get('/mon-atelier/commandes', query: {'echeance': 'aujourdhui', 'limit': 50}), decodeOrder);
Res<Order> orderProvider(WidgetRef ref, int id) => Res.one(ref, ['commande', uid(ref), id], (api) => api.get('/mon-atelier/commandes/$id'), decodeOrder);

/// Ce que montre l'onglet Commandes : les trois onglets, ou une vue posée par le tableau de bord.
enum OrdersView { enCours, pret, livre, impayees, retard, aujourdhui, mois }

/// Le compteur repart à chaque appui, même vue comprise, sinon l'écran garderait son onglet.
class OrdersFilter extends Notifier<(OrdersView, int)> {
  @override
  (OrdersView, int) build() => (OrdersView.enCours, 0);
  void set(OrdersView v) => state = (v, state.$2 + 1);
}
final ordersFilterProvider = NotifierProvider<OrdersFilter, (OrdersView, int)>(OrdersFilter.new);

void invalidateOrders() => invalidate({'commandes', 'commande', 'client', 'tableau'});

class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});
  @override
  ConsumerState<OrdersScreen> createState() => _OrdersState();
}

class _OrdersState extends ConsumerState<OrdersScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  late OrdersView _view;
  bool _searching = false;
  String _q = '';

  int get _tab => switch (_view) { OrdersView.pret => 1, OrdersView.livre || OrdersView.mois => 2, _ => 0 };
  bool get _filtered => _view == OrdersView.impayees || _view == OrdersView.retard || _view == OrdersView.aujourdhui;

  @override
  void initState() {
    super.initState();
    _view = ref.read(ordersFilterProvider).$1;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () { if (mounted) setState(() => _q = v.trim()); });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(ordersFilterProvider, (_, f) => setState(() => _view = f.$1));
    final view = _view, filtered = _filtered, month = view == OrdersView.mois;
    // L'onglet Livré demande les deux statuts fermés au serveur ; rien n'est filtré localement.
    final orders = ordersProvider(ref,
      switch (view) {
        OrdersView.enCours => 'en_cours',
        OrdersView.pret => 'pret',
        OrdersView.livre || OrdersView.mois => 'livre,annule',
        OrdersView.retard || OrdersView.aujourdhui => 'en_cours,pret',
        OrdersView.impayees => null,
      },
      unpaid: view == OrdersView.impayees, overdue: view == OrdersView.retard, dueToday: view == OrdersView.aujourdhui,
      q: _q, sort: _tab == 2 ? 'desc' : null);
    final now = DateTime.now();
    // Le mois se lit sur la date de livraison réelle, pas sur l'échéance promise.
    bool inMonth(Order o) => o.deliveredAt != null && o.deliveredAt!.year == now.year && o.deliveredAt!.month == now.month;
    void show(OrdersView v) => ref.read(ordersFilterProvider.notifier).set(v);
    return AppScaffold(
      actions: [
        AppIconButton(icon: _searching ? FIcons.x : FIcons.search, label: 'Rechercher', onTap: () { _debounce?.cancel(); _searchCtrl.clear(); setState(() { _searching = !_searching; _q = ''; }); }),
        AppIconButton(icon: FIcons.plus, label: 'Nouvelle commande', onTap: () => context.push('/atelier/commandes/nouvelle')),
      ],
      onRefresh: () => Future.wait([orders.refetch(), dashboardProvider(ref).refetch()]),
      // Le retard se compte sur tout l'atelier, pas sur la page chargée : le tableau de bord fait foi.
      body: dashboardProvider(ref).watch((board, _) => orders.watch((loaded) {
        final shown = month ? loaded?.where(inMonth).toList() : loaded;
        final featured = view == OrdersView.enCours && shown != null && shown.length > 1 ? shown.reduce((a, b) => a.dueAt.isBefore(b.dueAt) ? a : b) : null;
        final late = board == null ? 0 : (board['overdue_orders'] as num?)?.toInt() ?? 0;
        final lateText = '$late commande${late > 1 ? 's' : ''} en retard';
        final banner = switch (view) {
          OrdersView.impayees => _Banner(FIcons.banknote, 'Seulement les impayées', action: 'Tout voir', onTap: () => show(OrdersView.enCours)),
          OrdersView.aujourdhui => _Banner(FIcons.calendarClock, 'À livrer aujourd\'hui', action: 'Tout voir', onTap: () => show(OrdersView.enCours)),
          OrdersView.retard => _Banner(FIcons.clock, lateText, action: 'Tout voir', danger: true, onTap: () => show(OrdersView.enCours)),
          OrdersView.mois => _Banner(FIcons.packageCheck, 'Livrées ce mois-ci', action: 'Tout voir', onTap: () => show(OrdersView.livre)),
          OrdersView.enCours when late > 0 => _Banner(FIcons.clock, lateText, action: 'Voir', danger: true, onTap: () => show(OrdersView.retard)),
          _ => null,
        };
        final head = banner == null && featured == null ? null : Padding(
          padding: const EdgeInsets.fromLTRB(Insets.page, 0, Insets.page, Insets.lg),
          child: Column(spacing: Insets.lg, children: [?banner, if (featured != null) _Featured(featured)]),
        );
        final empty = AppState(kind: AppStateKind.empty, title: 'Aucune commande', message: filtered || month ? 'Aucune commande ne correspond à ce filtre.' : 'Créez-en une avec le bouton +.');
        return Column(children: [
          if (!filtered) AppSegmented(options: const ['En cours', 'Prêt', 'Livré'], index: _tab, onChanged: (i) => show(const [OrdersView.enCours, OrdersView.pret, OrdersView.livre][i])),
          if (_searching) Padding(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.sm, Insets.page, Insets.lg), child: AppField(label: 'Rechercher', hint: 'Nom du client ou référence', controller: _searchCtrl, autofocus: true, onChanged: _onSearchChanged))
          else AppTitle(_headline(shown, board), centered: true),
          Expanded(child: PagedList(orders,
            group: _group,
            padding: const EdgeInsets.only(bottom: Insets.xxl),
            skeleton: const Column(children: [Expanded(child: AppSkeleton()), AppWaking()]),
            filter: (o) => (!month || inMonth(o)) && o.id != featured?.id,
            header: (_) => head,
            // Le bandeau reste au-dessus du vide : c'est la seule sortie du filtre.
            empty: head == null ? empty : ListView(children: [head, empty]),
            item: _OrderRow.new,
          )),
        ]);
      })),
    );
  }

  /// Les compteurs du tableau portent sur tout l'atelier ; la page chargée ne sert que de repli.
  String _headline(List<Order>? shown, Json? board) {
    if (shown == null) return 'Vos commandes';
    int count(String key) => (board?[key] as num?)?.toInt() ?? shown.length;
    String phrase(int n, String zero, String one, String many) => n == 0 ? zero : n == 1 ? one : many;
    final n = shown.length, delivered = count('delivered_month'), overdue = count('overdue_orders'), active = count('en_cours_orders'), ready = count('pret_orders');
    return switch (_view) {
      OrdersView.mois => delivered == 1 ? 'Une livrée ce mois' : '$delivered livrées ce mois',
      OrdersView.aujourdhui => phrase(n, 'Rien à livrer aujourd\'hui', 'Une commande aujourd\'hui', '$n commandes aujourd\'hui'),
      OrdersView.impayees => phrase(n, 'Aucune commande impayée', 'Une commande impayée', '$n commandes impayées'),
      OrdersView.retard => phrase(overdue, 'Aucune commande en retard', 'Une commande en retard', '$overdue commandes en retard'),
      OrdersView.livre => phrase(n, 'Aucune commande terminée', 'Une commande terminée', '$n commandes terminées'),
      OrdersView.pret => phrase(ready, 'Aucune commande prête', 'Vous avez une commande prête', 'Vous avez $ready commandes prêtes'),
      OrdersView.enCours => phrase(active, 'Aucune commande en cours', 'Vous avez une commande en cours', 'Vous avez $active commandes en cours'),
    };
  }
}

/// Les impayés regroupés par client : un sous-total et une relance par personne.
class UnpaidByClientScreen extends ConsumerWidget {
  const UnpaidByClientScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ordersProvider(ref, null, unpaid: true);
    return AppScaffold(
      title: 'Reste à payer par client',
      onRefresh: orders.refetch,
      body: PagedList(orders,
        group: (o) => o.clientName,
        groupAction: (_, list) => _Reminder(list),
        padding: const EdgeInsets.only(bottom: Insets.xxl),
        empty: const AppState(kind: AppStateKind.empty, title: 'Rien à encaisser', message: 'Toutes vos commandes sont réglées.'),
        item: (o) => AppRow(
          title: o.description?.isNotEmpty == true ? o.description! : o.reference,
          subtitle: relativeDue(o.dueAt),
          onTap: () => context.push('/atelier/commandes/${o.id}'),
          trailing: AppMoney(o.remainingCfa, short: true),
        ),
      ),
    );
  }
}

class _Reminder extends ConsumerWidget {
  const _Reminder(this.orders);
  final List<Order> orders;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final total = orders.fold(0, (s, o) => s + o.remainingCfa);
    final phone = clientPhone(ref, orders.first);
    return Row(mainAxisSize: MainAxisSize.min, spacing: Insets.sm, children: [
      AppMoney(total, short: true),
      if (phone != null) AppIconButton(icon: FIcons.messageCircle, label: 'Relancer ${orders.first.clientName} sur WhatsApp', onTap: () {
        final atelier = atelierName(ref);
        openWhatsApp(phone, text: orders.length == 1
          ? balanceMessage(orders.first, atelier)
          : 'Bonjour ${firstName(orders.first.clientName)}, il reste ${formatCfa(total)} à régler pour vos commandes chez $atelier. Merci.');
      }),
    ]);
  }
}

class _Banner extends StatelessWidget {
  const _Banner(this.icon, this.text, {required this.action, required this.onTap, this.danger = false});
  final IconData icon;
  final String text, action;
  final bool danger;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final color = danger ? context.tones.danger : context.colors.onSurface;
    return Semantics(button: true, child: GestureDetector(
      onTap: onTap,
      child: DecoratedBox(
        decoration: BoxDecoration(color: danger ? color.withValues(alpha: .1) : context.tones.sunken, borderRadius: Radii.card),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: Insets.page, vertical: Insets.lg),
          child: Row(children: [
            Icon(icon, size: 20, color: color), const SizedBox(width: Insets.md),
            Expanded(child: Text(text, style: context.text.labelLarge!.copyWith(color: color))),
            Text(action, style: context.text.bodySmall!.copyWith(color: color)),
          ]),
        ),
      ),
    ));
  }
}

/// La commande la plus urgente : en retard d'abord, sinon la plus proche échéance.
class _Featured extends StatelessWidget {
  const _Featured(this.o);
  final Order o;
  @override
  Widget build(BuildContext context) => AppKeyTile(
    label: 'À livrer en premier · ${relativeDue(o.dueAt)}',
    onTap: () => context.push('/atelier/commandes/${o.id}'),
    value: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(o.clientName, style: context.text.headlineMedium!.copyWith(color: context.colors.onPrimary), maxLines: 2, overflow: TextOverflow.ellipsis),
      if (o.description?.isNotEmpty == true) Text(o.description!, style: context.text.bodyMedium!.copyWith(color: context.colors.onPrimary.withValues(alpha: .7)), maxLines: 1, overflow: TextOverflow.ellipsis),
      const SizedBox(height: Insets.lg),
      Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, spacing: Insets.sm, children: [
        Text('Reste à payer', style: context.text.bodyMedium!.copyWith(color: context.colors.onPrimary.withValues(alpha: .7))),
        AppMoney(o.remainingCfa, style: AppText.moneyLg),
      ]),
    ]),
  );
}

String _group(Order o) {
  if (!o.isOpen) return toBeginningOfSentenceCase(DateFormat('MMMM yyyy', 'fr').format(o.dueAt));
  final d = daysUntil(o.dueAt);
  if (d < 0) return 'En retard';
  if (d == 0) return 'Aujourd\'hui';
  if (d < 7) return 'Cette semaine';
  if (d < 30) return 'Ce mois-ci';
  return 'Plus tard';
}

class _OrderRow extends ConsumerWidget {
  const _OrderRow(this.o);
  final Order o;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final row = AppRow(
      leading: AppAvatar(name: o.clientName),
      title: o.clientName,
      subtitle: [
        if (o.beneficiaryLabel != null) 'pour ${o.beneficiaryLabel}',
        if (o.description?.isNotEmpty == true) o.description!,
        o.isOpen ? relativeDue(o.dueAt) : DateFormat('d MMM yyyy', 'fr').format(o.dueAt),
      ].join(' · '),
      onTap: () => context.push('/atelier/commandes/${o.id}'),
      trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, spacing: Insets.xs, children: [
        AppMoney(o.remainingCfa, short: true),
        if (o.status == 'annule') const AppTag('Annulée', tone: AppTone.danger)
        else if (o.isLate) const AppTag('En retard', tone: AppTone.danger)
        else if (o.readyDays > 3) AppTag('Prêt depuis ${o.readyDays} jours', tone: AppTone.warning)
        else if (o.remainingCfa == 0) const AppTag('Payée', tone: AppTone.success),
      ]),
    );
    // Une commande livrée qui garde un solde reste encaissable ; une commande annulée, non.
    final advance = nextStatus(o);
    final pay = o.remainingCfa > 0 && o.status != 'annule';
    if (advance == null && !pay) return row;
    final payBg = _swipeBg(context, FIcons.banknote, 'Encaisser', AlignmentDirectional.centerEnd);
    return Dismissible(
      key: ValueKey(o.id),
      direction: advance == null ? DismissDirection.endToStart : pay ? DismissDirection.horizontal : DismissDirection.startToEnd,
      background: advance == null ? payBg : _swipeBg(context, FIcons.check, advance.$1, AlignmentDirectional.centerStart),
      secondaryBackground: advance != null && pay ? payBg : null,
      confirmDismiss: (d) async {
        if (d == DismissDirection.startToEnd && advance != null) {
          await setStatus(ref, context, o, advance.$2);
        } else {
          await collectPayment(ref, context, o);
        }
        return false;
      },
      child: row,
    );
  }

  Widget _swipeBg(BuildContext c, IconData i, String l, AlignmentGeometry a) => Container(
    color: c.colors.primary, alignment: a, padding: const EdgeInsets.symmetric(horizontal: Insets.page),
    child: Column(mainAxisSize: MainAxisSize.min, children: [Icon(i, color: c.colors.onPrimary), Text(l, style: c.text.bodySmall!.copyWith(color: c.colors.onPrimary))]),
  );
}

const _statusToasts = {'en_cours': 'Commande remise en cours.', 'pret': 'Commande prête.', 'livre': 'Commande livrée.', 'annule': 'Commande annulée.'};

/// Étape suivante autorisée, ou null si la commande est fermée.
(String, String)? nextStatus(Order o) => switch (o.status) {
  'en_cours' => ('Prêt', 'pret'),
  'pret' => ('Livré', 'livre'),
  _ => null,
};

/// Retour en arrière autorisé par l'API : pret→en_cours, livre→pret, annule→en_cours.
(String, String)? previousStatus(Order o) => switch (o.status) {
  'pret' || 'annule' => ('Remettre en cours', 'en_cours'),
  'livre' => ('Remettre en prêt', 'pret'),
  _ => null,
};

String atelierName(WidgetRef ref) => ref.read(userProvider)?.atelier?.name ?? 'Gnawalma';

String readyMessage(Order o, String atelier) =>
    'Bonjour ${firstName(o.clientName)}, votre commande ${o.reference} est prête chez $atelier. Vous pouvez passer la récupérer.'
    '${o.remainingCfa > 0 ? ' Reste à payer : ${formatCfa(o.remainingCfa)}.' : ''}';

String balanceMessage(Order o, String atelier) =>
    'Bonjour ${firstName(o.clientName)}, il reste ${formatCfa(o.remainingCfa)} à régler pour votre commande ${o.reference} chez $atelier. Merci.';

/// La liste des commandes ne porte pas le numéro du client : il est repris de la liste des clients en cache.
String? clientPhone(WidgetRef ref, Order o) {
  if (o.clientPhone != null) return o.clientPhone;
  if (o.clientId == null) return null;
  final clients = clientsProvider(ref);
  return clients.items(clients.query.state.data).where((c) => c.id == o.clientId).firstOrNull?.phone;
}

/// Après « Marquer prêt » : le client attend un message, pas un appel.
/// La feuille se ferme depuis son propre contexte : la ligne d'origine a pu disparaître de la liste.
Future<void> notifyReady(BuildContext context, WidgetRef ref, Order o, String phone) {
  return showAppSheet(context, title: 'Prévenir le client ?', child: Builder(builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Text('${o.clientName} · ${prettyPhone(phone)}', style: ctx.text.bodyMedium!.copyWith(color: ctx.tones.inkSecondary)),
    const SizedBox(height: Insets.xl),
    AppButton('Envoyer sur WhatsApp', icon: FIcons.messageCircle, onPressed: () { popSheet(ctx); openWhatsApp(phone, text: readyMessage(o, atelierName(ref))); }),
    const SizedBox(height: Insets.sm),
    AppButton('Plus tard', variant: AppButtonVariant.ghost, onPressed: () => popSheet(ctx)),
  ])));
}

// Un changement de statut par commande à la fois : glissement et bouton visent la même ligne.
final _statusBusy = <int>{};

Future<void> setStatus(WidgetRef ref, BuildContext context, Order o, String status) async {
  if (!_statusBusy.add(o.id)) return;
  try {
    if (status == 'livre') {
      final ok = await confirm(context, title: 'Marquer cette commande livrée ?',
        message: o.remainingCfa > 0 ? 'Il reste ${formatCfa(o.remainingCfa)} à encaisser.' : null, action: 'Marquer livré');
      if (!ok || !context.mounted) return;
    }
    await ref.read(apiProvider).patch('/mon-atelier/commandes/${o.id}/statut', {'status': status});
    // Le rappel de veille n'a de sens que sur une commande encore en cours.
    if (status != 'en_cours') { try { await cancelDueReminder(o.id); } catch (_) {} }
    invalidateOrders();
    if (!context.mounted) return;
    toast(context, _statusToasts[status] ?? 'Commande mise à jour.');
    final phone = status == 'pret' ? clientPhone(ref, o) : null;
    if (phone != null) await notifyReady(context, ref, o, phone);
  } on ApiException catch (e) {
    if (context.mounted) toast(context, e.message);
  } finally {
    _statusBusy.remove(o.id);
  }
}

Future<void> collectPayment(WidgetRef ref, BuildContext context, Order o) async {
  final ctrl = TextEditingController();
  // Une seule clé par ouverture de la feuille : un réessai après coupure ne double pas l'encaissement.
  final token = clientToken();
  try {
    String? error;
    final amount = await askSheet<int>(context, title: 'Encaisser', dirty: () => ctrl.text.trim().isNotEmpty, child: StatefulBuilder(builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [Text('Reste à payer', style: ctx.text.bodyMedium!.copyWith(color: ctx.tones.inkSecondary)), const Spacer(), AppMoney(o.remainingCfa)]),
      const SizedBox(height: Insets.lg),
      AppField(label: 'Montant reçu', controller: ctrl, keyboardType: TextInputType.number, formatters: AppField.digitsOnly, maxLength: 9, autofocus: true, error: error, suffix: Padding(padding: const EdgeInsets.only(right: Insets.md), child: Center(widthFactor: 1, child: Text('FCFA', style: ctx.text.bodyMedium!.copyWith(color: ctx.tones.inkSecondary))))),
      const SizedBox(height: Insets.sm),
      Row(children: [
        Expanded(child: AppButton('La moitié', variant: AppButtonVariant.ghost, onPressed: () => ctrl.text = '${o.remainingCfa ~/ 2}')),
        Expanded(child: AppButton('Solde entier', variant: AppButtonVariant.ghost, onPressed: () => ctrl.text = '${o.remainingCfa}')),
      ]),
      const SizedBox(height: Insets.lg),
      AppButton('Enregistrer le paiement', onPressed: () {
        final v = int.tryParse(ctrl.text) ?? 0;
        if (v <= 0) return set(() => error = 'Indiquez un montant supérieur à 0.');
        if (v > o.remainingCfa) return set(() => error = 'Le montant dépasse le reste à payer (${formatCfa(o.remainingCfa)}).');
        popSheet(ctx, v);
      }),
    ])));
    if (amount == null || amount == 0) return;
    try {
      final paid = await ref.read(apiProvider).post('/mon-atelier/commandes/${o.id}/paiements', {'amount_cfa': amount, 'client_token': token});
      invalidateOrders();
      if (!context.mounted) return;
      toast(context, '${formatCfa(amount)} encaissés.');
      // La réponse porte le journal et les totaux à jour ; le client vient de la commande en main.
      await receiptSheet(context, ref, decodeOrder({...?o.raw, ...(paid as Map).cast<String, dynamic>()}));
    } on ApiException catch (e) {
      if (context.mounted) toast(context, e.message);
    }
  } finally {
    ctrl.dispose();
  }
}

// La feuille tient dans le navigateur racine : le partage part de son contexte, la ligne de liste peut disparaître.
Future<void> receiptSheet(BuildContext context, WidgetRef ref, Order o) => showAppSheet(context, title: 'Reçu', child: Builder(builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
  Text('Un reçu pour ${o.clientName} : dernier paiement, total payé et reste à payer.', style: ctx.text.bodyMedium!.copyWith(color: ctx.tones.inkSecondary)),
  const SizedBox(height: Insets.xl),
  AppButton('Envoyer le reçu', icon: FIcons.share2, onPressed: () async {
    await shareReceipt(ctx, ref, o);
    if (ctx.mounted) popSheet(ctx);
  }),
  const SizedBox(height: Insets.sm),
  AppButton('Envoyer le bon de commande', variant: AppButtonVariant.secondary, icon: FIcons.fileText, onPressed: () async {
    await shareSlip(ctx, ref, o);
    if (ctx.mounted) popSheet(ctx);
  }),
  const SizedBox(height: Insets.sm),
  AppButton('Fermer', variant: AppButtonVariant.ghost, onPressed: () => popSheet(ctx)),
])));

/// Correction d'un encaissement : l'API n'efface rien, on poste l'écart, négatif si besoin.
Future<void> correctPayment(WidgetRef ref, BuildContext context, Order o, Payment p) async {
  final ctrl = TextEditingController(text: '${p.amountCfa}');
  final token = clientToken();
  try {
    String? error;
    final correct = await askSheet<int>(context, title: 'Corriger le paiement', dirty: () => ctrl.text.trim() != '${p.amountCfa}',
      child: StatefulBuilder(builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [Text('Montant enregistré', style: ctx.text.bodyMedium!.copyWith(color: ctx.tones.inkSecondary)), const Spacer(), AppMoney(p.amountCfa)]),
        const SizedBox(height: Insets.lg),
        AppField(label: 'Montant correct', controller: ctrl, keyboardType: TextInputType.number, formatters: AppField.digitsOnly, maxLength: 9, autofocus: true, error: error,
          suffix: Padding(padding: const EdgeInsets.only(right: Insets.md), child: Center(widthFactor: 1, child: Text('FCFA', style: ctx.text.bodyMedium!.copyWith(color: ctx.tones.inkSecondary))))),
        const SizedBox(height: Insets.lg),
        AppButton('Enregistrer la correction', onPressed: () {
          final v = int.tryParse(ctrl.text);
          if (v == null) return set(() => error = 'Indiquez le montant réellement reçu.');
          if (o.paidCfa - p.amountCfa + v > o.totalCfa) return set(() => error = 'Le total payé dépasserait le montant de la commande.');
          popSheet(ctx, v);
        }),
      ])));
    if (correct == null || correct == p.amountCfa) return;
    try {
      await ref.read(apiProvider).post('/mon-atelier/commandes/${o.id}/paiements', {'amount_cfa': correct - p.amountCfa, 'correction_of': p.id, 'client_token': token});
      invalidateOrders();
      if (context.mounted) toast(context, 'Paiement corrigé.');
    } on ApiException catch (e) {
      if (context.mounted) toast(context, e.message);
    }
  } finally {
    ctrl.dispose();
  }
}

class OrderScreen extends ConsumerWidget {
  const OrderScreen(this.id, {super.key});
  final int id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Remote(orderProvider(ref, id), page: true, skeleton: const AppSkeleton(rows: 4, height: 96), builder: _OrderDetail.new);
  }
}

class _OrderDetail extends ConsumerWidget {
  const _OrderDetail(this.o);
  final Order o;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tones;
    final next = nextStatus(o);
    // Une commande annulée ne s'encaisse plus.
    final canPay = o.remainingCfa > 0 && o.status != 'annule';
    var busy = false;
    final muted = context.text.bodyMedium!.copyWith(color: t.inkSecondary);
    final path = o.measurementsPhotoPath;
    final measuresPhoto = o.measurementsPhotoUrl ?? (path == null ? null : mediaUrl(path));
    return AppScaffold(
      actions: [
        if (o.clientPhone != null) AppIconButton(icon: FIcons.phone, label: 'Appeler', onTap: () => launchUrl(Uri.parse('tel:${o.clientPhone}'))),
        AppIconButton(icon: FIcons.share, label: 'Partager le bon', onTap: () => shareSlip(context, ref, o)),
        AppIconButton(icon: FIcons.ellipsis, label: 'Plus', onTap: () => _menu(context, ref)),
      ],
      bottom: !canPay && next == null ? null : StatefulBuilder(builder: (ctx, set) => Row(children: [
        if (canPay) ...[
          Expanded(child: AppButton('Encaisser', variant: next == null ? AppButtonVariant.primary : AppButtonVariant.secondary, onPressed: () => collectPayment(ref, ctx, o))),
          if (next != null) const SizedBox(width: Insets.md),
        ],
        if (next != null) Expanded(child: AppButton('Marquer ${next.$1.toLowerCase()}', loading: busy, onPressed: () async {
          set(() => busy = true);
          await setStatus(ref, ctx, o, next.$2);
          if (ctx.mounted) set(() => busy = false);
        })),
      ])),
      body: ListView(padding: const EdgeInsets.fromLTRB(Insets.page, Insets.sm, Insets.page, Insets.xxl), children: [
        Semantics(button: o.clientId != null, label: 'Fiche de ${o.clientName}', child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: o.clientId == null ? null : () => context.push('/atelier/clients/${o.clientId}'),
          child: Column(children: [
            AppAvatar(name: o.clientName, size: 72),
            const SizedBox(height: Insets.md),
            Text(o.clientName, style: context.text.displayMedium, textAlign: TextAlign.center),
            if (o.beneficiaryLabel != null) ...[const SizedBox(height: Insets.xs), Text('Pour ${o.beneficiaryLabel}', style: muted, textAlign: TextAlign.center)],
          ]),
        )),
        const SizedBox(height: Insets.xl),
        AppKeyTile(label: 'Reste à payer', value: AppMoney(o.remainingCfa, style: AppText.moneyXl)),
        const SizedBox(height: Insets.md),
        Row(mainAxisAlignment: MainAxisAlignment.center, spacing: Insets.sm, children: [
          AppTag(orderStatuses[o.status] ?? o.status, tone: o.isLate ? AppTone.danger : o.status == 'pret' ? AppTone.success : AppTone.neutral),
          Flexible(child: Text('${relativeDue(o.dueAt)} · ${o.reference}', style: muted.copyWith(color: o.isLate ? t.danger : t.inkSecondary), overflow: TextOverflow.ellipsis)),
        ]),
        const SizedBox(height: Insets.xl),
        if (o.clientPhone case final phone?) ...[
          Padding(padding: const EdgeInsets.only(bottom: Insets.sm), child: Text('Contacter', style: context.text.titleMedium)),
          AppCard.rows([
            AppRow(leading: const Icon(FIcons.phone), title: 'Appeler', subtitle: prettyPhone(phone), onTap: () => launchUrl(Uri.parse('tel:$phone'))),
            AppRow(leading: const Icon(FIcons.messageCircle), title: 'WhatsApp', onTap: () => openWhatsApp(phone)),
            if (o.status == 'pret')
              AppRow(leading: const Icon(FIcons.bellRing), title: 'Relancer sur WhatsApp', subtitle: o.readyDays == 0 ? 'Commande prête' : o.readyDays == 1 ? 'Prête depuis un jour' : 'Prête depuis ${o.readyDays} jours',
                onTap: () => openWhatsApp(phone, text: readyMessage(o, atelierName(ref)))),
            if (o.remainingCfa > 0)
              AppRow(leading: const Icon(FIcons.banknote), title: 'Rappeler le reste à payer', subtitle: formatCfa(o.remainingCfa),
                onTap: () => openWhatsApp(phone, text: balanceMessage(o, atelierName(ref)))),
          ]),
          const SizedBox(height: Insets.lg),
        ],
        _Section('Mesures', child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SelectableText(o.measurements, style: context.text.bodyLarge!.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
          if (measuresPhoto != null) ...[const SizedBox(height: Insets.md), AppPhoto(measuresPhoto)],
        ])),
        if (o.fabricPhotoUrl != null) ...[const SizedBox(height: Insets.lg), _Section('Tissu', child: AppPhoto(o.fabricPhotoUrl))],
        if (o.description?.isNotEmpty == true) ...[const SizedBox(height: Insets.lg), _Section('Description', child: Text(o.description!, style: context.text.bodyLarge))],
        if (o.voiceNoteUrl case final voice?) ...[const SizedBox(height: Insets.lg), _Section('Note vocale', child: VoicePlayer(voice))],
        const SizedBox(height: Insets.lg),
        _Section('Paiements', child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (o.payments.isEmpty) Text('Aucun paiement.', style: muted),
          // Une correction se lit avec sa date ; l'API refuse qu'on la corrige à son tour.
          for (final p in o.paymentsChrono) _line(context, DateFormat('d MMMM yyyy', 'fr').format(p.at), AppMoney(p.amountCfa),
            tag: o.isCorrection(p) ? const AppTag('Correction') : null,
            action: o.isCorrection(p) ? null : AppIconButton(icon: FIcons.pencil, label: 'Corriger ce paiement', onTap: () => correctPayment(ref, context, o, p))),
          const SizedBox(height: Insets.sm),
          const AppDivider(inset: false),
          const SizedBox(height: Insets.sm),
          _line(context, 'Total payé', AppMoney(o.paidCfa, style: AppText.moneyLg)),
          _line(context, 'Montant de la commande', o.hasTotal ? AppMoney(o.totalCfa, style: AppText.moneyLg) : Text('À fixer', style: muted)),
        ])),
      ]),
    );
  }

  Widget _line(BuildContext c, String label, Widget amount, {Widget? action, Widget? tag}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: Insets.sm),
    child: Row(spacing: Insets.sm, children: [Expanded(child: Text(label, style: c.text.bodyLarge)), ?tag, amount, ?action]),
  );

  void _menu(BuildContext context, WidgetRef ref) => showAppSheet(context, child: Column(mainAxisSize: MainAxisSize.min, children: [
    AppRow(title: 'Modifier la commande', leading: const Icon(FIcons.pencil), onTap: () { popSheet(context); context.push('/atelier/commandes/${o.id}/modifier'); }),
    if (previousStatus(o) case final back?)
      AppRow(title: back.$1, leading: const Icon(FIcons.undo2), onTap: () { popSheet(context); setStatus(ref, context, o, back.$2); }),
    if (o.status != 'annule') AppRow(title: 'Annuler la commande', danger: true, leading: Icon(FIcons.circleX, color: context.tones.danger), onTap: () async {
      popSheet(context);
      if (await confirm(context, title: 'Annuler cette commande ?', message: 'Elle restera visible dans l\'onglet Livré comme annulée.', action: 'Annuler la commande', danger: true) && context.mounted) {
        await setStatus(ref, context, o, 'annule');
      }
    }),
  ]));
}

/// Le bon et le reçu n'existent qu'en image : ils sont rendus hors écran le temps d'une frame.
Future<void> _shareDocument(BuildContext context, Widget document, {required String name, required String text}) async {
  final key = GlobalKey();
  final overlay = OverlayEntry(builder: (_) => Positioned(left: -2000, child: Material(child: CaptureBox(boundary: key, child: document))));
  Overlay.of(context).insert(overlay);
  try {
    await WidgetsBinding.instance.endOfFrame;
    if (context.mounted) await shareCapture(context, key, name: name, text: text);
  } finally {
    overlay.remove();
  }
}

Future<void> shareSlip(BuildContext context, WidgetRef ref, Order o) async {
  await precache([o.fabricPhotoUrl], context);
  if (!context.mounted) return;
  await _shareDocument(context, _Slip(o, ref.read(userProvider)?.atelier), name: o.reference, text: 'Bon de commande ${o.reference}');
}

Future<void> shareReceipt(BuildContext context, WidgetRef ref, Order o) =>
    _shareDocument(context, _Receipt(o, ref.read(userProvider)?.atelier), name: 'recu-${o.reference}', text: 'Reçu ${o.reference}');

/// Carte blanche titrée : un bloc de la fiche commande.
class _Section extends StatelessWidget {
  const _Section(this.title, {required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => AppCard(
    padding: const EdgeInsets.all(Insets.page),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: context.text.titleMedium),
      const SizedBox(height: Insets.md),
      child,
    ]),
  );
}

/// Le bon de commande, rendu en image. Toujours en clair, quel que soit le thème.
class _Slip extends StatelessWidget {
  const _Slip(this.o, this.atelier);
  final Order o;
  final Atelier? atelier;
  @override
  Widget build(BuildContext context) {
    // Le cumul suit l'ordre chronologique du journal, corrections comprises.
    var running = 0;
    final journal = [for (final p in o.paymentsChrono) (p, running += p.amountCfa)];
    return Theme(data: buildTheme(Brightness.light), child: Builder(builder: (c) => Container(
      width: 420, color: c.colors.surface, padding: const EdgeInsets.all(Insets.xxl),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        _Letterhead(atelier),
        const SizedBox(height: Insets.xl), const AppDivider(inset: false), const SizedBox(height: Insets.lg),
        Text('Bon de commande ${o.reference}', style: c.text.bodySmall!.copyWith(color: c.tones.inkSecondary)),
        Text(o.clientName, style: c.text.displayMedium),
        if (o.beneficiaryLabel != null) Text('Pour ${o.beneficiaryLabel}', style: c.text.bodyMedium!.copyWith(color: c.tones.inkSecondary)),
        const SizedBox(height: Insets.lg),
        _slipLine(c, 'Livraison', DateFormat('d MMMM yyyy', 'fr').format(o.dueAt)),
        if (o.description?.isNotEmpty == true) _slipLine(c, 'Travail', o.description!)
        // Le bon est une image : la note vocale n'y tient pas, elle est seulement signalée.
        else if (o.voiceNoteUrl != null) _slipLine(c, 'Description', 'note vocale enregistrée'),
        _slipLine(c, 'Mesures', o.measurements),
        if (o.fabricPhotoUrl != null) Padding(padding: const EdgeInsets.only(bottom: Insets.sm), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 90, child: Text('Tissu', style: c.text.bodyMedium!.copyWith(color: c.tones.inkSecondary))),
          SizedBox(width: 96, child: AppPhoto(o.fabricPhotoUrl, aspectRatio: 1, radius: Radii.control)),
        ])),
        const SizedBox(height: Insets.lg), const AppDivider(inset: false), const SizedBox(height: Insets.lg),
        _slipLine(c, 'Montant', o.hasTotal ? formatCfa(o.totalCfa) : 'À fixer'),
        for (final (p, total) in journal)
          _slipLine(c, DateFormat('d MMM yyyy', 'fr').format(p.at), '${o.isCorrection(p) ? 'Correction ' : ''}${formatCfa(p.amountCfa)}   (cumul ${formatCfa(total)})'),
        _slipLine(c, 'Payé', formatCfa(o.paidCfa)),
        const SizedBox(height: Insets.sm),
        Row(children: [Text('Reste à payer', style: c.text.titleMedium), const Spacer(), Text(formatCfa(o.remainingCfa), style: AppText.moneyLg.copyWith(color: c.colors.onSurface))]),
      ]),
    )));
  }
}

Widget _slipLine(BuildContext c, String k, String v) => Padding(padding: const EdgeInsets.only(bottom: Insets.sm), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
  SizedBox(width: 90, child: Text(k, style: c.text.bodyMedium!.copyWith(color: c.tones.inkSecondary))), Expanded(child: Text(v, style: c.text.bodyMedium)),
]));

/// En-tête commun au bon et au reçu.
class _Letterhead extends StatelessWidget {
  const _Letterhead(this.atelier);
  final Atelier? atelier;
  @override
  Widget build(BuildContext context) {
    final muted = context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary);
    final place = [atelier?.address, atelier?.region].whereType<String>().join(', ');
    return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Text(atelier?.name ?? 'Gnawalma', style: context.text.titleLarge),
      if (place.isNotEmpty) Text(place, style: muted),
      if (atelier?.phone != null) Text(prettyPhone(atelier!.phone!), style: muted),
    ]);
  }
}

/// Le reçu : un document court, centré sur le dernier paiement. Toujours en clair.
class _Receipt extends StatelessWidget {
  const _Receipt(this.o, this.atelier);
  final Order o;
  final Atelier? atelier;
  @override
  Widget build(BuildContext context) {
    final last = o.paymentsChrono.lastOrNull;
    return Theme(data: buildTheme(Brightness.light), child: Builder(builder: (c) => Container(
      width: 420, color: c.colors.surface, padding: const EdgeInsets.all(Insets.xxl),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        _Letterhead(atelier),
        const SizedBox(height: Insets.xl), const AppDivider(inset: false), const SizedBox(height: Insets.lg),
        Text('Reçu', style: c.text.displayMedium),
        Text('Commande ${o.reference}', style: c.text.bodySmall!.copyWith(color: c.tones.inkSecondary)),
        const SizedBox(height: Insets.lg),
        _slipLine(c, 'Client', o.clientName),
        if (last != null) _slipLine(c, 'Date', DateFormat('d MMMM yyyy', 'fr').format(last.at)),
        const SizedBox(height: Insets.md),
        if (last != null) DecoratedBox(
          decoration: BoxDecoration(color: c.tones.sunken, borderRadius: Radii.control),
          child: Padding(padding: const EdgeInsets.all(Insets.lg), child: Row(children: [
            Text(o.isCorrection(last) ? 'Correction' : 'Paiement reçu', style: c.text.titleMedium),
            const Spacer(),
            Text(formatCfa(last.amountCfa), style: AppText.moneyLg.copyWith(color: c.colors.onSurface)),
          ])),
        ),
        const SizedBox(height: Insets.lg),
        _slipLine(c, 'Total payé', formatCfa(o.paidCfa)),
        Row(children: [Text('Reste à payer', style: c.text.titleMedium), const Spacer(), Text(formatCfa(o.remainingCfa), style: AppText.moneyLg.copyWith(color: c.colors.onSurface))]),
      ]),
    )));
  }
}

class NewOrderScreen extends ConsumerStatefulWidget {
  const NewOrderScreen({super.key, this.clientId});
  final int? clientId;
  @override
  ConsumerState<NewOrderScreen> createState() => _NewOrderState();
}

class _NewOrderState extends ConsumerState<NewOrderScreen> {
  late int _step = widget.clientId == null ? 1 : 2;
  late int? _clientId = widget.clientId;
  String _clientName = '';
  final _form = OrderForm();
  bool _busy = false;

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, _) { if (!didPop) _back(); },
    child: AppScaffold(
      onBack: _back,
      bottom: _step == 1 ? null : AppButton(_step == 3 ? 'Créer la commande' : 'Suivant', loading: _busy, onPressed: _next),
      body: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(padding: const EdgeInsets.fromLTRB(Insets.page, 0, Insets.page, Insets.sm), child: Row(spacing: Insets.xs, children: [
          for (var i = 1; i <= 3; i++) Expanded(child: DecoratedBox(decoration: BoxDecoration(color: i <= _step ? context.colors.onSurface : context.tones.hairline, borderRadius: Radii.full), child: const SizedBox(height: 3))),
        ])),
        AppTitle(switch (_step) { 1 => 'Pour quel client ?', 2 => 'Mesures et livraison', _ => 'Montant' }),
        Expanded(child: switch (_step) {
          1 => _ClientStep(onPicked: (id, name) => setState(() { _clientId = id; _clientName = name; _step = 2; })),
          2 => _form.step2(context, ref, _clientId!, () => setState(() {})),
          _ => _form.step3(context, () => setState(() {})),
        }),
      ]),
    ),
  );

  @override
  void dispose() {
    _form.dispose();
    super.dispose();
  }

  Future<void> _back() async {
    // Venue d'une fiche client, l'étape 1 n'existe pas : le retour quitte la commande.
    final firstStep = widget.clientId == null ? 1 : 2;
    if (_step > firstStep) return setState(() => _step--);
    if (_form.filled && !await confirm(context, title: 'Abandonner cette commande ?', message: 'Les informations saisies seront perdues.', action: 'Abandonner', danger: true)) return;
    if (mounted) context.pop();
  }

  Future<void> _next() async {
    if (_step == 2) {
      if (!_form.validateStep2()) { setState(() {}); return; }
      setState(() => _step = 3);
      return;
    }
    if (!_form.validateStep3()) { setState(() {}); return; }
    setState(() => _busy = true);
    try {
      final r = await ref.read(apiProvider).post('/mon-atelier/commandes', {'client_id': _clientId, ..._form.body()});
      try { await scheduleDueReminder(id: r['id'], clientName: _clientName, dueAt: _form.dueAt!); } catch (_) {}
      invalidateOrders();
      if (mounted) { toast(context, 'Commande créée pour $_clientName.'); context.pushReplacement('/atelier/commandes/${r['id']}'); }
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class EditOrderScreen extends ConsumerStatefulWidget {
  const EditOrderScreen(this.id, {super.key});
  final int id;
  @override
  ConsumerState<EditOrderScreen> createState() => _EditOrderState();
}

class _EditOrderState extends ConsumerState<EditOrderScreen> {
  OrderForm? _form;
  bool _busy = false;

  @override
  void dispose() {
    _form?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Remote(orderProvider(ref, widget.id), page: true, builder: (o) {
    final f = _form ??= OrderForm.from(o);
    return AppScaffold(
      title: 'Modifier',
      bottom: AppButton('Enregistrer', loading: _busy, onPressed: () => _save(o.id, o.clientName, f)),
      body: ListView(padding: const EdgeInsets.fromLTRB(Insets.page, 0, Insets.page, Insets.xxl), children: [
        f.step2(context, ref, o.clientId, () => setState(() {}), scroll: false),
        const SizedBox(height: Insets.lg),
        f.step3(context, () => setState(() {}), scroll: false, showDeposit: false),
      ]),
    );
  });

  Future<void> _save(int id, String clientName, OrderForm f) async {
    if (!f.validateAll()) { setState(() {}); return; }
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).patch('/mon-atelier/commandes/$id', f.body(deposit: false));
      try { await scheduleDueReminder(id: id, clientName: clientName, dueAt: f.dueAt!); } catch (_) {}
      invalidateOrders();
      if (mounted) { toast(context, 'Modifications enregistrées.'); context.pop(); }
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _ClientStep extends ConsumerStatefulWidget {
  const _ClientStep({required this.onPicked});
  final void Function(int id, String name) onPicked;
  @override
  ConsumerState<_ClientStep> createState() => _ClientStepState();
}

class _ClientStepState extends ConsumerState<_ClientStep> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  String _q = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () { if (mounted) setState(() => _q = v.trim()); });
  }

  // Un numéro tapé dans la recherche part dans le champ téléphone, pas dans le nom.
  Future<void> _create() async {
    final digits = phoneDigits(_q);
    final isPhone = digits.isNotEmpty && RegExp(r'^[\d\s+]+$').hasMatch(_q);
    final c = await quickCreateClient(context, ref, name: isPhone ? '' : _q, phone: isPhone ? digits : '');
    if (c != null) widget.onPicked(c.id, c.name);
  }

  @override
  Widget build(BuildContext context) {
    final clients = clientsProvider(ref, q: _q);
    return Column(children: [
      Padding(padding: const EdgeInsets.symmetric(horizontal: Insets.page), child: AppField(label: 'Rechercher un client', hint: 'Nom ou téléphone', controller: _searchCtrl, onChanged: _onSearchChanged)),
      const SizedBox(height: Insets.lg),
      Padding(padding: const EdgeInsets.symmetric(horizontal: Insets.page), child: AppCard.rows([
        AppRow(title: 'Choisir dans mes contacts', leading: const Icon(FIcons.bookUser), onTap: () async {
          final c = await ContactsPicker.open(context, ref);
          if (c != null) widget.onPicked(c.id, c.name);
        }),
        AppRow(title: 'Nouveau client', leading: const Icon(FIcons.userPlus), onTap: _create),
      ])),
      const SizedBox(height: Insets.lg),
      Expanded(child: PagedList(clients,
        card: true,
        padding: const EdgeInsets.only(bottom: Insets.page),
        skeleton: const AppSkeleton(rows: 4),
        empty: Padding(padding: const EdgeInsets.symmetric(horizontal: Insets.page), child: AppCard.rows([
          AppRow(title: _q.isEmpty ? 'Aucun client' : 'Créer « $_q »', leading: const Icon(FIcons.userPlus), onTap: _create),
        ])),
        item: (c) => AppRow(leading: AppAvatar(name: c.name), title: c.name, subtitle: c.phone == null ? null : prettyPhone(c.phone!), onTap: () => widget.onPicked(c.id, c.name)),
      )),
    ]);
  }
}

Future<Client?> quickCreateClient(BuildContext context, WidgetRef ref, {String name = '', String phone = ''}) async {
  final n = TextEditingController(text: name), p = TextEditingController(text: formatPhone(phone));
  try {
    String? error, phoneErr;
    final ok = await askSheet<bool>(context, title: 'Nouveau client', dirty: () => n.text.trim() != name.trim() || phoneDigits(p.text) != phoneDigits(phone),
      child: StatefulBuilder(builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      AppField(label: 'Nom complet', controller: n, autofocus: name.isEmpty, error: error, textInputAction: TextInputAction.next), const SizedBox(height: Insets.lg),
      AppPhoneField(controller: p, error: phoneErr, autofocus: name.isNotEmpty), const SizedBox(height: Insets.xl),
      AppButton('Ajouter', onPressed: () {
        set(() { error = n.text.trim().length < 2 ? 'Le nom est requis.' : null; phoneErr = phoneError(p.text, required: false); });
        if (error == null && phoneErr == null) popSheet(ctx, true);
      }),
    ])));
    if (ok != true) return null;
    try {
      final known = await findClientByPhone(ref, p.text);
      if (known != null) {
        if (context.mounted) toast(context, 'Ce numéro est déjà chez ${known.name}.');
        return known;
      }
      final c = Client.fromJson(await ref.read(apiProvider).post('/mon-atelier/clients', {'name': n.text.trim(), 'phone': phoneE164(p.text)}));
      invalidate({'clients'});
      if (context.mounted) toast(context, 'Client ajouté.');
      return c;
    } on ApiException catch (e) {
      if (context.mounted) toast(context, e.message);
      return null;
    }
  } finally {
    n.dispose();
    p.dispose();
  }
}

// Choix ajouté aux bénéficiaires : ouvre la feuille de création au lieu de sélectionner.
const _newBeneficiary = -1;

Widget _formLabel(BuildContext c, String s) => Padding(
  padding: const EdgeInsets.only(bottom: Insets.sm),
  child: Text(s, style: c.text.bodySmall!.copyWith(color: c.tones.inkSecondary, fontWeight: FontWeight.w600)),
);

/// Un bénéficiaire créé sans quitter la commande en cours.
Future<int?> addBeneficiary(BuildContext context, WidgetRef ref, int clientId) async {
  final label = TextEditingController(), measurements = TextEditingController();
  var gender = 'femme';
  try {
    String? error;
    final ok = await askSheet<bool>(context, title: 'Ajouter un bénéficiaire',
      dirty: () => label.text.trim().isNotEmpty || measurements.text.trim().isNotEmpty,
      child: StatefulBuilder(builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        AppField(label: 'Qui est-ce ?', controller: label, hint: 'Awa, mon fils, moi-même', error: error, autofocus: true),
        const SizedBox(height: Insets.lg),
        AppChoice(options: specialties.keys.toList(), selected: {gender}, label: (g) => specialties[g]!, onChanged: (g) => set(() => gender = g)),
        const SizedBox(height: Insets.lg),
        AppField(label: 'Mesures (facultatif)', controller: measurements, maxLines: 3, hint: '48 / 108 / 90 / 63 / 42 / 96'),
        const SizedBox(height: Insets.xl),
        AppButton('Ajouter', onPressed: () {
          if (label.text.trim().isEmpty) return set(() => error = 'Indiquez qui est cette personne.');
          popSheet(ctx, true);
        }),
      ])));
    if (ok != true) return null;
    try {
      final r = await ref.read(apiProvider).post('/mon-atelier/clients/$clientId/beneficiaires', {'label': label.text.trim(), 'gender': gender, 'measurements': measurements.text.trim()});
      invalidate({'client'});
      return r['id'] as int;
    } on ApiException catch (e) {
      if (context.mounted) toast(context, e.message);
      return null;
    }
  } finally {
    label.dispose();
    measurements.dispose();
  }
}

/// Une photo du formulaire : choix, envoi immédiat, aperçu. La photo est facultative, un envoi manqué est abandonné.
class OrderPhoto {
  OrderPhoto(this.kind, this.title);
  final String kind, title;
  String? path, url;
  bool uploading = false;
  // Photo retirée : l'enregistrement doit envoyer null, pas omettre la clé.
  bool cleared = false;

  bool get filled => path != null;
  bool get changed => path != null || cleared;

  void clear() {
    path = null;
    url = null;
    cleared = true;
  }

  Future<void> _choose(BuildContext context, WidgetRef ref, VoidCallback refresh) async {
    if (uploading) return;
    final x = await pickPhoto(context, title: title);
    if (x == null || !context.mounted) return;
    final oldPath = path, oldUrl = url;
    uploading = true;
    refresh();
    try {
      path = await ref.read(apiProvider).upload(File(x.path), kind);
      url = mediaUrl(path!);
      cleared = false;
    } catch (_) {
      path = oldPath;
      url = oldUrl;
      if (context.mounted) toast(context, 'Photo non envoyée. Vous pourrez réessayer plus tard.');
    } finally {
      uploading = false;
      refresh();
    }
  }

  Widget well(BuildContext context, WidgetRef ref, VoidCallback refresh) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    _formLabel(context, title),
    Semantics(button: true, label: url != null ? 'Remplacer : $title' : 'Ajouter : $title', child: GestureDetector(
      onTap: () => _choose(context, ref, refresh),
      child: uploading
        ? Container(height: 120, decoration: BoxDecoration(color: context.tones.sunken, borderRadius: Radii.container), child: const Center(child: FCircularProgress()))
        : url != null ? AppPhoto(url)
        : Container(height: 120, decoration: BoxDecoration(color: context.tones.sunken, borderRadius: Radii.container), child: Icon(FIcons.camera, size: 32, color: context.tones.inkTertiary)),
    )),
    if (!uploading && url != null) ...[
      const SizedBox(height: Insets.sm),
      AppButton('Retirer', variant: AppButtonVariant.ghost, size: 44, icon: FIcons.trash2, onPressed: () { clear(); refresh(); }),
    ],
  ]);
}

const _voiceMax = Duration(seconds: 60);
const _voiceBars = 16;
const _voiceFloor = .06;

/// Bouton rond dessiné : Forui n'a pas de bouton icône assez grand pour la lecture et l'arrêt.
class _RoundButton extends StatelessWidget {
  const _RoundButton({required this.icon, required this.label, required this.onTap, this.size = 48});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final double size;
  @override
  Widget build(BuildContext context) => FTappable(
    onPress: onTap, semanticsLabel: label, behavior: HitTestBehavior.opaque,
    child: Container(
      width: size, height: size,
      decoration: BoxDecoration(color: context.colors.primary, shape: BoxShape.circle),
      child: AnimatedSwitcher(
        duration: Motion.fast,
        child: Icon(icon, key: ValueKey(icon), size: size * .38, color: context.colors.onPrimary),
      ),
    ),
  );
}

/// Barre de progression dessinée : LinearProgressIndicator est un widget Material.
class _VoiceBar extends StatelessWidget {
  const _VoiceBar(this.value);
  final double value;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(end: value.isFinite ? value.clamp(0, 1) : 0),
    duration: Motion.fast, curve: Curves.easeOutCubic,
    builder: (c, v, _) => ClipRRect(borderRadius: Radii.full, child: Container(
      height: 4, color: c.tones.hairline,
      child: FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: v, child: ColoredBox(color: c.colors.onSurface)),
    )),
  );
}

/// Lecteur de note vocale, partagé par le formulaire et la fiche commande.
class VoicePlayer extends StatefulWidget {
  const VoicePlayer(this.url, {super.key});
  final String url;
  @override
  State<VoicePlayer> createState() => _VoicePlayerState();
}

class _VoicePlayerState extends State<VoicePlayer> {
  final _player = AudioPlayer();
  final _subs = <StreamSubscription<Object?>>[];
  Duration _at = Duration.zero, _length = Duration.zero;
  bool _playing = false;

  @override
  void initState() {
    super.initState();
    _open();
    _subs.add(_player.positionStream.listen((p) { if (mounted) setState(() => _at = p); }));
    _subs.add(_player.playerStateStream.listen((s) {
      final done = s.processingState == ProcessingState.completed;
      if (done) { _player.pause(); _player.seek(Duration.zero); }
      if (mounted) setState(() => _playing = s.playing && !done);
    }));
  }

  @override
  void dispose() {
    for (final s in _subs) { s.cancel(); }
    _player.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    try {
      final d = await _player.setUrl(widget.url);
      if (mounted) setState(() => _length = d ?? Duration.zero);
    } catch (_) {
      // Sans réseau la source reste vide : la touche Lecture réessaiera.
    }
  }

  Future<void> _toggle() async {
    try {
      if (_player.playing) return _player.pause();
      if (_player.processingState == ProcessingState.idle) _length = await _player.setUrl(widget.url) ?? Duration.zero;
      await _player.play();
    } catch (_) {
      if (mounted) toast(context, 'Lecture impossible. Vérifiez votre connexion.');
    }
  }

  @override
  Widget build(BuildContext context) => Row(spacing: Insets.md, children: [
    _RoundButton(icon: _playing ? FIcons.pause : FIcons.play, label: _playing ? 'Mettre en pause' : 'Écouter la note vocale', onTap: _toggle),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, spacing: Insets.sm, children: [
      _VoiceBar(_length.inMilliseconds == 0 ? 0 : _at.inMilliseconds / _length.inMilliseconds),
      Text('${formatClock(_at)} / ${formatClock(_length)}',
        style: context.text.bodySmall!.copyWith(color: context.tones.inkSecondary, fontFeatures: const [FontFeature.tabularFigures()])),
    ])),
  ]);
}

/// Anneau de progression jusqu'à une minute, tracé autour du bouton d'arrêt.
class _RingPainter extends CustomPainter {
  const _RingPainter(this.progress, this.track, this.ink);
  final double progress;
  final Color track, ink;
  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero), radius = (size.shortestSide - 4) / 2;
    final brush = Paint()..style = PaintingStyle.stroke..strokeWidth = 4..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, brush..color = track);
    canvas.drawArc(Rect.fromCircle(center: center, radius: radius), -pi / 2, 2 * pi * progress, false, brush..color = ink);
  }
  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress || old.ink != ink;
}

/// Bouton d'arrêt de 64 dp, son anneau de progression et son halo qui respire.
class _StopRing extends StatelessWidget {
  const _StopRing({required this.elapsed, required this.pulse, required this.onStop});
  final Animation<double> elapsed, pulse;
  final VoidCallback onStop;
  @override
  Widget build(BuildContext context) => SizedBox.square(dimension: 88, child: Stack(alignment: Alignment.center, children: [
    AnimatedBuilder(animation: pulse, builder: (c, _) {
      final t = Curves.easeInOut.transform(pulse.value);
      return Container(
        width: 68 + 20 * t, height: 68 + 20 * t,
        decoration: BoxDecoration(shape: BoxShape.circle, color: c.tones.danger.withValues(alpha: .22 * (1 - t))),
      );
    }),
    AnimatedBuilder(animation: elapsed, builder: (c, _) => CustomPaint(
      size: const Size.square(78), painter: _RingPainter(elapsed.value, c.tones.hairline, c.tones.danger))),
    _RoundButton(icon: FIcons.square, label: 'Arrêter l\'enregistrement', size: 64, onTap: onStop),
  ]));
}

/// Amplitudes des dernières 1,3 s : la plus ancienne sort par la gauche à chaque mesure.
class _VoiceLevels extends StatelessWidget {
  const _VoiceLevels(this.levels);
  final List<double> levels;
  @override
  Widget build(BuildContext context) => SizedBox(height: 30, child: Row(children: [
    for (final level in levels) Padding(
      padding: const EdgeInsets.only(right: 3),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 80), curve: Curves.easeOut,
        width: 3, height: 4 + 26 * level,
        decoration: BoxDecoration(color: context.tones.inkTertiary, borderRadius: Radii.full),
      ),
    ),
  ]));
}

/// La note vocale d'une commande : enregistrer, envoyer, réécouter, retirer.
class VoiceNoteField extends ConsumerStatefulWidget {
  const VoiceNoteField({super.key, required this.url, required this.onChanged});
  final String? url;
  final void Function(String? path, String? url) onChanged;
  @override
  ConsumerState<VoiceNoteField> createState() => _VoiceNoteState();
}

class _VoiceNoteState extends ConsumerState<VoiceNoteField> with TickerProviderStateMixin {
  final _recorder = AudioRecorder();
  late final AnimationController _elapsed, _pulse;
  StreamSubscription<Amplitude>? _amplitudes;
  List<double> _levels = const [];
  bool _recording = false, _sending = false;

  @override
  void initState() {
    super.initState();
    _elapsed = AnimationController(vsync: this, duration: _voiceMax)
      ..addStatusListener((s) { if (s == AnimationStatus.completed) _stop(); });
    _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));
  }

  @override
  void dispose() {
    _amplitudes?.cancel();
    _elapsed.dispose();
    _pulse.dispose();
    _recorder.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    if (!await _recorder.hasPermission()) {
      if (mounted) toast(context, 'Autorisez le micro dans les réglages du téléphone.');
      return;
    }
    if (!mounted) return;
    final calm = MediaQuery.disableAnimationsOf(context);
    try {
      final dir = await getTemporaryDirectory();
      await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc, numChannels: 1),
        path: '${dir.path}/note-${DateTime.now().millisecondsSinceEpoch}.m4a');
    } catch (_) {
      if (mounted) toast(context, 'Enregistrement impossible. Réessayez.');
      return;
    }
    await HapticFeedback.mediumImpact();
    if (!mounted) return;
    _elapsed.forward(from: 0);
    if (!calm) {
      _pulse.repeat(reverse: true);
      _amplitudes = _recorder.onAmplitudeChanged(const Duration(milliseconds: 80)).listen(_measure);
    }
    setState(() { _recording = true; _levels = calm ? const [] : List.filled(_voiceBars, _voiceFloor); });
  }

  // dBFS : au-delà de -50 dB c'est du silence.
  void _measure(Amplitude a) {
    if (!mounted) return;
    setState(() => _levels = [..._levels.skip(1), (1 + a.current / 50).clamp(_voiceFloor, 1).toDouble()]);
  }

  Future<void> _stop() async {
    if (!_recording) return;
    _recording = false;
    _elapsed.stop();
    _pulse.stop();
    await _amplitudes?.cancel();
    _amplitudes = null;
    final file = await _recorder.stop();
    await HapticFeedback.mediumImpact();
    if (!mounted) return;
    setState(() { _levels = const []; _sending = file != null; });
    if (file == null) return;
    try {
      final path = await ref.read(apiProvider).upload(File(file), 'voix');
      widget.onChanged(path, mediaUrl(path));
    } catch (_) {
      if (mounted) toast(context, 'Note vocale non envoyée. Réessayez.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _remove() async {
    if (await confirm(context, title: 'Retirer la note vocale ?', action: 'Retirer', danger: true) && mounted) widget.onChanged(null, null);
  }

  @override
  Widget build(BuildContext context) {
    final url = widget.url;
    final step = url != null ? 3 : _sending ? 2 : _recording ? 1 : 0;
    return AnimatedSwitcher(
      duration: Motion.base, switchInCurve: Curves.easeOutCubic, switchOutCurve: Curves.easeOutCubic,
      transitionBuilder: (child, a) => FadeTransition(opacity: a,
        child: SlideTransition(position: Tween(begin: const Offset(0, .06), end: Offset.zero).animate(a), child: child)),
      child: Column(key: ValueKey(step), crossAxisAlignment: CrossAxisAlignment.stretch, children: switch (step) {
        3 => [
          VoicePlayer(url!, key: ValueKey(url)),
          const SizedBox(height: Insets.sm),
          AppButton('Retirer', variant: AppButtonVariant.ghost, size: 48, icon: FIcons.trash2, onPressed: _remove),
        ],
        2 => [Row(spacing: Insets.md, children: [
          const FCircularProgress(size: FCircularProgressSizeVariant.sm),
          Text('Envoi…', style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary)),
        ])],
        1 => [Row(spacing: Insets.lg, children: [
          _StopRing(elapsed: _elapsed, pulse: _pulse, onStop: _stop),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, spacing: Insets.sm, children: [
            AnimatedBuilder(animation: _elapsed, builder: (c, _) => Text('${formatClock(_voiceMax * _elapsed.value)} / ${formatClock(_voiceMax)}',
              style: c.text.titleMedium!.copyWith(fontFeatures: const [FontFeature.tabularFigures()]))),
            _VoiceLevels(_levels),
          ])),
        ])],
        _ => [AppButton('Enregistrer une note vocale', icon: FIcons.mic, variant: AppButtonVariant.secondary, onPressed: _start)],
      }),
    );
  }
}

/// Champs partagés entre création (étapes 2 et 3) et modification.
class OrderForm {
  OrderForm() : editing = false;
  OrderForm.from(Order o) : editing = true {
    measurements.text = o.measurements; description.text = o.description ?? ''; total.text = '${o.totalCfa}';
    dueAt = o.dueAt; beneficiaryId = o.beneficiaryId;
    fabric.url = o.fabricPhotoUrl;
    notebook.url = o.measurementsPhotoUrl ?? (o.measurementsPhotoPath == null ? null : mediaUrl(o.measurementsPhotoPath!));
    voiceNotePath = o.voiceNotePath;
    voiceNoteUrl = o.voiceNoteUrl ?? (o.voiceNotePath == null ? null : mediaUrl(o.voiceNotePath!));
  }
  final bool editing;
  final measurements = TextEditingController(), description = TextEditingController(), total = TextEditingController(), deposit = TextEditingController();
  DateTime? dueAt;
  int? beneficiaryId;
  String? voiceNotePath, voiceNoteUrl;
  final fabric = OrderPhoto('tissu', 'Photo du tissu');
  final notebook = OrderPhoto('mesures', 'Photo du cahier de mesures');
  Map<String, String> errors = {};
  // Une clé par formulaire : renvoyée telle quelle au réessai, l'API ne crée pas deux commandes.
  final token = clientToken();
  final _measurementsKey = GlobalKey(), _dueAtKey = GlobalKey(), _totalKey = GlobalKey();

  void dispose() {
    for (final c in [measurements, description, total, deposit]) { c.dispose(); }
  }

  int get totalCfa => int.tryParse(total.text) ?? 0;
  int get depositCfa => (int.tryParse(deposit.text) ?? 0).clamp(0, totalCfa);
  bool get filled => measurements.text.trim().isNotEmpty || description.text.trim().isNotEmpty || total.text.trim().isNotEmpty || fabric.filled || notebook.filled || voiceNotePath != null;

  Map<String, String> get _step2Errors => {
    if (measurements.text.trim().isEmpty) 'measurements': 'Indiquez les mesures.',
    if (dueAt == null) 'dueAt': 'Choisissez une date de livraison.'
    else if (!editing && daysUntil(dueAt!) < 0) 'dueAt': 'Cette date est déjà passée.',
  };
  Map<String, String> get _step3Errors => {if (totalCfa <= 0) 'total': 'Indiquez un montant supérieur à 0.'};

  bool validateStep2() => _show(_step2Errors);
  bool validateStep3() => _show(_step3Errors);

  /// Modification : les deux étapes tiennent sur une seule page, aucune erreur ne doit en effacer une autre.
  bool validateAll() => _show({..._step2Errors, ..._step3Errors});

  bool _show(Map<String, String> found) {
    errors = found;
    final key = errors.containsKey('measurements') ? _measurementsKey : errors.containsKey('dueAt') ? _dueAtKey : errors.containsKey('total') ? _totalKey : null;
    if (key != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = key.currentContext;
        if (ctx != null) Scrollable.ensureVisible(ctx, duration: Motion.base);
      });
    }
    return errors.isEmpty;
  }

  Map<String, dynamic> body({bool deposit = true}) => {
    'beneficiary_id': beneficiaryId, 'measurements': measurements.text.trim(), 'description': description.text.trim(),
    'due_at': dueAt!.toIso8601String(), 'total_cfa': totalCfa, 'voice_note_path': voiceNotePath,
    if (deposit) ...{'acompte_cfa': depositCfa, 'client_token': token},
    if (fabric.changed) 'fabric_photo_path': fabric.path, if (notebook.changed) 'measurements_photo_path': notebook.path,
  };

  Widget step2(BuildContext context, WidgetRef ref, int? clientId, VoidCallback refresh, {bool scroll = true}) {
    if (clientId == null) return _step2Body(context, ref, null, refresh, scroll: scroll);
    return clientProvider(ref, clientId).watch((client, _) => _step2Body(context, ref, client, refresh, scroll: scroll));
  }

  Widget _step2Body(BuildContext context, WidgetRef ref, Client? client, VoidCallback refresh, {required bool scroll}) {
    final bens = client?.beneficiaries ?? [];
    final selected = bens.where((b) => b.id == beneficiaryId).firstOrNull;
    // Les commandes du client arrivent de la plus récente à la plus ancienne ; en modification la première est celle qu'on édite.
    final previous = editing ? const <Order>[] : (client?.orders ?? []).where((o) => o.measurements.trim().isNotEmpty).toList();
    final last = previous.where((o) => o.beneficiaryId == beneficiaryId).firstOrNull ?? previous.firstOrNull;
    String? reuseLabel, reuse;
    if (last != null) {
      reuseLabel = 'Reprendre les mesures de la dernière commande';
      reuse = last.measurements;
    } else if (selected?.measurements?.isNotEmpty == true) {
      reuseLabel = 'Dernières mesures de ${selected!.label}';
      reuse = selected.measurements;
    }
    final children = [
      if (client != null) ...[
        _formLabel(context, 'Pour qui ?'),
        AppChoice<int?>(
          options: [null, ...bens.map((b) => b.id), _newBeneficiary], selected: {beneficiaryId},
          label: (id) => id == null ? 'Le client' : id == _newBeneficiary ? 'Ajouter un bénéficiaire' : bens.firstWhere((b) => b.id == id).label,
          onChanged: (id) async {
            if (id != _newBeneficiary) { beneficiaryId = id; refresh(); return; }
            final created = await addBeneficiary(context, ref, client.id);
            if (created != null) beneficiaryId = created;
            refresh();
          },
        ),
        const SizedBox(height: Insets.xl),
      ],
      if (reuse != null && reuse != measurements.text)
        Container(margin: const EdgeInsets.only(bottom: Insets.md), padding: const EdgeInsets.all(Insets.lg), decoration: BoxDecoration(color: context.tones.sunken, borderRadius: Radii.control),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(reuseLabel!, style: context.text.bodySmall!.copyWith(color: context.tones.inkSecondary)), Text(reuse, style: context.text.bodyMedium)])),
            AppButton('Réutiliser', variant: AppButtonVariant.ghost, size: 44, onPressed: () { measurements.text = reuse!; refresh(); }),
          ])),
      AppField(key: _measurementsKey, label: 'Mesures', controller: measurements, hint: '48 / 108 / 90 / 63 / 42 / 96', maxLines: 4, error: errors['measurements'], onChanged: (_) => refresh()),
      const SizedBox(height: Insets.lg),
      notebook.well(context, ref, refresh),
      const SizedBox(height: Insets.xl),
      _formLabel(context, 'Date de livraison'),
      AppChoice<int>(options: const [3, 7, 14], selected: {if (dueAt != null) daysUntil(dueAt!)}, label: (d) => d == 3 ? 'Dans 3 jours' : d == 7 ? 'Dans 1 semaine' : 'Dans 2 semaines', onChanged: (d) { dueAt = today().add(Duration(days: d)); refresh(); }),
      const SizedBox(height: Insets.md),
      Column(key: _dueAtKey, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        AppButton(dueAt == null ? 'Choisir une date' : DateFormat('EEEE d MMMM yyyy', 'fr').format(dueAt!), icon: FIcons.calendar, variant: AppButtonVariant.secondary, onPressed: () async {
          final d = await showDatePickerSheet(context, initial: dueAt);
          if (d != null) { dueAt = d; refresh(); }
        }),
        if (errors['dueAt'] != null) Padding(padding: const EdgeInsets.only(top: Insets.xs), child: Text(errors['dueAt']!, style: context.text.bodySmall!.copyWith(color: context.tones.danger))),
      ]),
      const SizedBox(height: Insets.xl),
      fabric.well(context, ref, refresh),
      const SizedBox(height: Insets.xl),
      AppField(label: 'Description', controller: description, maxLines: 3, hint: 'Modèle, couleur, détails convenus'),
      const SizedBox(height: Insets.md),
      Padding(padding: const EdgeInsets.only(bottom: Insets.sm),
        child: Text('Ou dites-le : la note vocale remplace le texte.', style: context.text.bodySmall!.copyWith(color: context.tones.inkSecondary))),
      VoiceNoteField(key: const ValueKey('voix'), url: voiceNoteUrl, onChanged: (path, url) { voiceNotePath = path; voiceNoteUrl = url; refresh(); }),
    ];
    return _card(children, scroll: scroll);
  }

  Widget step3(BuildContext context, VoidCallback refresh, {bool scroll = true, bool showDeposit = true}) {
    final children = [
      AppField(key: _totalKey, label: 'Montant total', controller: total, keyboardType: TextInputType.number, formatters: AppField.digitsOnly, maxLength: 9, autofocus: showDeposit, error: errors['total'], onChanged: (_) => refresh(), suffix: _cfa(context)),
      if (showDeposit) ...[
        const SizedBox(height: Insets.xl),
        _formLabel(context, 'Acompte'),
        AppChoice<int>(options: const [0, 50, 100], selected: {if (totalCfa > 0 && depositCfa == 0) 0, if (totalCfa > 0 && depositCfa == totalCfa ~/ 2) 50, if (totalCfa > 0 && depositCfa == totalCfa) 100}, label: (p) => p == 0 ? 'Aucun' : p == 50 ? 'La moitié' : 'Tout', onChanged: (p) { deposit.text = p == 0 ? '' : '${totalCfa * p ~/ 100}'; refresh(); }),
        const SizedBox(height: Insets.md),
        AppField(label: 'Ou un autre montant', controller: deposit, keyboardType: TextInputType.number, formatters: AppField.digitsOnly, maxLength: 9, onChanged: (_) => refresh(), suffix: _cfa(context),
          error: (int.tryParse(deposit.text) ?? 0) > totalCfa ? 'L\'acompte ne peut pas dépasser le montant. Seul ${formatCfa(totalCfa)} sera enregistré.' : null),
        const SizedBox(height: Insets.xxl),
        Row(children: [Text('Reste à payer', style: context.text.titleMedium), const Spacer(), AppMoney((totalCfa - depositCfa).clamp(0, totalCfa), style: AppText.moneyLg)]),
      ],
    ];
    return _card(children, scroll: scroll);
  }

  Widget _card(List<Widget> children, {required bool scroll}) {
    final card = AppCard(padding: const EdgeInsets.all(Insets.page), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children));
    return scroll ? ListView(padding: const EdgeInsets.fromLTRB(Insets.page, 0, Insets.page, Insets.xxl), children: [card]) : card;
  }

  Widget _cfa(BuildContext c) => Padding(padding: const EdgeInsets.only(right: Insets.md), child: Center(widthFactor: 1, child: Text('FCFA', style: c.text.bodyMedium!.copyWith(color: c.tones.inkSecondary))));
}
