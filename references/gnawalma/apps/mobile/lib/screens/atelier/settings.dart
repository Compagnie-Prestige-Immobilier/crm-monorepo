import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart' hide FThemeBuildContext;
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:share_plus/share_plus.dart';

import '../../api.dart';
import '../../config.dart';
import '../../models.dart';
import '../../notifications.dart';
import '../../queries.dart';
import '../../session.dart';
import '../../ui.dart';
import '../auth.dart' show PinScreen, deleteAccountFlow;

const _themes = {'system': 'Système', 'light': 'Clair', 'dark': 'Sombre'};


class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});
  @override
  ConsumerState<SettingsScreen> createState() => _SettingsState();
}

class _SettingsState extends ConsumerState<SettingsScreen> {
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
    final atelier = user?.atelier;
    final theme = ref.watch(themePrefProvider).value ?? 'system';
    final dueReminders = ref.watch(dueRemindersPrefProvider).value != '0';
    final t = context.tones;
    final secondary = context.text.bodySmall!.copyWith(color: t.inkSecondary);
    return AppScaffold(
      body: Column(children: [
        const AppTitle('Réglages', centered: true),
        Expanded(child: ListView(padding: const EdgeInsets.symmetric(horizontal: Insets.page), children: [
          if (atelier != null) AppCard(onTap: () => context.push('/atelier/reglages/profil'), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            AppPhoto(atelier.coverThumbUrl, fallbackText: atelier.name, aspectRatio: 16 / 7, radius: BorderRadius.zero),
            Padding(padding: const EdgeInsets.all(Insets.page), child: Row(spacing: Insets.lg, children: [
              AppAvatar(name: atelier.name, imageUrl: atelier.logoThumbUrl, size: 48),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, spacing: Insets.xs, children: [
                Text(atelier.name, style: context.text.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
                Text([if (atelier.region != null) atelier.region!, atelier.verified ? 'Atelier vérifié' : 'En attente de vérification'].join(' · '), style: secondary),
              ])),
              Icon(FIcons.chevronRight, color: t.inkTertiary),
            ])),
          ])),
          if (atelier != null && !atelier.verified && atelier.verificationNote?.trim().isNotEmpty == true)
            Padding(padding: const EdgeInsets.fromLTRB(Insets.sm, Insets.sm, Insets.sm, 0), child: Text('Pour être vérifié : ${atelier.verificationNote!.trim()}', style: secondary)),
          _section(context, 'Compte'),
          AppCard.rows([
            AppRow(leading: AppAvatar(name: user?.name ?? '', size: 36), title: user?.name ?? '', subtitle: user?.phone == null ? user?.identifier : prettyPhone(user!.phone!), trailing: const SizedBox.shrink()),
            AppRow(leading: const Icon(FIcons.lock), title: 'Changer mon code', onTap: () => context.push('/atelier/reglages/code')),
          ]),
          if (atelier != null) ...[
            _section(context, 'Atelier'),
            AppCard.rows([
              AppRow(leading: const Icon(FIcons.store), title: 'Profil et vitrine', subtitle: 'Photos, adresse, spécialités', onTap: () => context.push('/atelier/reglages/profil')),
              AppRow(leading: const Icon(FIcons.inbox), title: 'Demandes reçues', onTap: () => context.go('/atelier/tableau/demandes')),
              AppRow(leading: const Icon(FIcons.share2), title: 'Partager mon atelier', subtitle: 'Carte de visite à envoyer', onTap: () => _shareCard(context, atelier, user!)),
              AppRow(leading: const Icon(FIcons.eye), title: 'Aperçu public', subtitle: 'Voir votre atelier comme un client', onTap: () => context.push('/atelier/reglages/apercu/${atelier.id}')),
            ]),
          ],
          _section(context, 'Notifications'),
          AppCard.rows([
            AppRow(
              leading: const Icon(FIcons.bellRing),
              title: 'Rappel la veille d\'une échéance',
              subtitle: 'Notification à 9 h',
              trailing: Semantics(
                label: 'Rappel la veille d\'une échéance', toggled: dueReminders,
                child: FSwitch(value: dueReminders, onChange: _toggleDueReminders),
              ),
            ),
          ]),
          _section(context, 'Application'),
          AppCard.rows([
            AppRow(leading: const Icon(FIcons.sunMoon), title: 'Thème', subtitle: _themes[theme], onTap: () => _pickTheme(context, ref, theme)),
          ]),
          _section(context, 'Aide'),
          AppCard.rows([
            AppRow(leading: const Icon(FIcons.lifeBuoy), title: 'Support client', subtitle: 'WhatsApp, appel, signalement', onTap: () => supportSheet(context, version: _version, identifier: user?.identifier)),
          ]),
          _section(context, 'À propos'),
          AppCard.rows([
            AppRow(leading: const Icon(FIcons.info), title: 'Version', trailing: Text(_version, style: secondary)),
            AppRow(leading: const Icon(FIcons.fileText), title: 'Conditions d\'utilisation', onTap: () => _legal(context, 'Conditions d\'utilisation', termsText)),
            AppRow(leading: const Icon(FIcons.shield), title: 'Confidentialité', onTap: () => _legal(context, 'Confidentialité', privacyText)),
            AppRow(leading: const Icon(FIcons.share), title: 'Partager l\'application', onTap: () => SharePlus.instance.share(ShareParams(text: 'Gnawalma connecte clients et ateliers de couture. Téléchargez l\'application pour gérer vos commandes.'))),
          ]),
          const SizedBox(height: Insets.xl),
          AppCard.rows([
            AppRow(leading: const Icon(FIcons.logOut), title: 'Se déconnecter', danger: true, trailing: const SizedBox.shrink(), onTap: () => _logout(context, ref)),
          ]),
          const SizedBox(height: Insets.lg),
          AppCard.rows([
            AppRow(leading: Icon(FIcons.trash2, color: t.danger), title: 'Supprimer mon compte', danger: true, trailing: const SizedBox.shrink(), onTap: () => deleteAccountFlow(context, ref)),
          ]),
          Padding(padding: const EdgeInsets.symmetric(vertical: Insets.xl), child: Text('Gnawalma · LIC', textAlign: TextAlign.center, style: secondary.copyWith(color: t.inkTertiary))),
        ])),
      ]),
    );
  }

  Future<void> _toggleDueReminders(bool on) async {
    final pref = ref.read(dueRemindersPrefProvider.notifier);
    if (!on) {
      await pref.set('0');
      await cancelDueReminders();
      return;
    }
    if (!await confirm(context, title: 'Activer le rappel ?', message: 'Gnawalma vous enverra une notification à 9 h la veille de chaque livraison.', action: 'Autoriser')) return;
    if (!await requestNotificationPermission()) {
      await pref.set('0');
      if (mounted) toast(context, 'Autorisez les notifications dans les réglages du téléphone.');
      return;
    }
    await pref.set(null);
    // Les commandes déjà ouvertes doivent retrouver leur rappel, pas seulement les suivantes.
    try {
      final open = await ref.read(apiProvider).page('/mon-atelier/commandes', decodeOrder, query: {'status': 'en_cours', 'limit': 50});
      await rescheduleDueReminders(open.items);
    } catch (_) {}
  }

  Widget _section(BuildContext context, String label) => Padding(
    padding: const EdgeInsets.fromLTRB(Insets.sm, Insets.xl, Insets.sm, Insets.sm),
    child: Text(label, style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary, fontWeight: FontWeight.w600)),
  );

  String _shareText(Atelier a, User u) => [
    '${a.name}, atelier de couture${a.region == null ? '' : ' à ${a.region}'}.',
    'Contact : ${a.phone == null ? u.identifier : prettyPhone(a.phone!)}.',
    'Retrouvez-le sur Gnawalma : ${atelierLink(a.id)}',
  ].join(' ');

  Future<void> _shareCard(BuildContext context, Atelier a, User u) async {
    await precache([a.coverUrl], context);
    if (!context.mounted) return;
    final key = GlobalKey();
    var busy = false;
    await showAppSheet(context, title: 'Carte de visite', child: StatefulBuilder(builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      CaptureBox(boundary: key, child: _BusinessCard(a, phone: a.phone == null ? u.identifier : prettyPhone(a.phone!))),
      const SizedBox(height: Insets.xl),
      AppButton('Partager', icon: FIcons.share2, loading: busy, onPressed: () async {
        set(() => busy = true);
        await shareCapture(ctx, key, name: 'gnawalma-${a.id}', text: _shareText(a, u));
        if (ctx.mounted) popSheet(ctx);
      }),
    ])));
  }


  Future<void> _legal(BuildContext context, String title, String text) =>
      showAppSheet<void>(context, title: title, child: Text(text, style: context.text.bodyLarge!.copyWith(color: context.tones.inkSecondary)));

  Future<void> _pickTheme(BuildContext context, WidgetRef ref, String current) async {
    final v = await pick<String>(context, title: 'Thème', options: _themes.keys.toList(), label: (k) => _themes[k]!, selected: current);
    if (v != null) await ref.read(themePrefProvider.notifier).set(v == 'system' ? null : v);
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    if (!await confirm(context, title: 'Se déconnecter ?', message: 'Vous devrez saisir votre identifiant et votre code pour revenir.', action: 'Se déconnecter', danger: true)) return;
    try { await ref.read(apiProvider).post('/auth/logout'); } catch (_) {}
    clearCache();
    await ref.read(sessionProvider.notifier).clear();
    if (context.mounted) context.go('/bienvenue');
  }

}

/// Le code se saisit au pavé de l'application, jamais au clavier système : code actuel, puis nouveau code.
class ChangePinScreen extends ConsumerWidget {
  const ChangePinScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => PinScreen(
    title: 'Votre code actuel',
    subtitle: 'Saisissez le code que vous utilisez aujourd\'hui.',
    onSubmit: (pin) async => {'pin': pin},
    onSuccess: (d) async => Navigator.of(context).push(MaterialPageRoute(builder: (_) => _NewPinScreen(d['pin'] as String))),
  );
}

class _NewPinScreen extends ConsumerWidget {
  const _NewPinScreen(this.current);
  final String current;
  @override
  Widget build(BuildContext context, WidgetRef ref) => PinScreen(
    title: 'Votre nouveau code',
    subtitle: '4 à 8 chiffres. Il servira à chaque connexion.',
    reveal: true,
    onSubmit: (pin) async { await ref.read(apiProvider).patch('/auth/me', {'pin': pin, 'current_pin': current}); return const {}; },
    onSuccess: (_) async {
      toast(context, 'Code modifié.');
      Navigator.of(context)..pop()..pop();
    },
  );
}

/// Carte partagée en image, au format 4:5 avec de larges marges : les aperçus de partage recadrent au centre.
class _BusinessCard extends StatelessWidget {
  const _BusinessCard(this.a, {required this.phone});
  final Atelier a;
  final String phone;
  @override
  Widget build(BuildContext context) {
    final t = context.tones, caption = context.text.bodyMedium!.copyWith(color: t.inkSecondary);
    final place = [a.address, a.region].where((s) => s?.isNotEmpty == true).join(', ');
    final card = ClipRRect(borderRadius: Radii.container, child: ColoredBox(color: context.colors.surface, child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      AppPhoto(a.coverUrl, fallbackText: a.name, aspectRatio: 16 / 9, radius: BorderRadius.zero),
      Padding(padding: const EdgeInsets.all(Insets.page), child: Column(crossAxisAlignment: CrossAxisAlignment.start, spacing: Insets.sm, children: [
        Row(spacing: Insets.md, children: [
          AppAvatar(name: a.name, imageUrl: a.logoThumbUrl, size: 44),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(a.name, style: context.text.headlineMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
            if (a.specialties.isNotEmpty) Text(a.specialties.map((s) => specialties[s] ?? s).join(' · '), style: caption, maxLines: 1, overflow: TextOverflow.ellipsis),
          ])),
        ]),
        if (place.isNotEmpty) Row(spacing: Insets.sm, children: [Icon(FIcons.mapPin, size: 16, color: t.inkSecondary), Expanded(child: Text(place, style: caption, maxLines: 1, overflow: TextOverflow.ellipsis))]),
        Row(spacing: Insets.sm, children: [Icon(FIcons.phone, size: 16, color: t.inkSecondary), Text(phone, style: context.text.titleMedium)]),
      ])),
    ])));
    return AspectRatio(aspectRatio: 4 / 5, child: ColoredBox(color: context.colors.primary, child: Padding(
      padding: const EdgeInsets.fromLTRB(36, 28, 36, 20),
      child: Column(children: [
        Expanded(child: Center(child: card)),
        const SizedBox(height: Insets.md),
        Text('Gnawalma · Les ateliers de couture du Sénégal', style: context.text.labelLarge!.copyWith(color: context.colors.onPrimary), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
      ]),
    )));
  }
}
