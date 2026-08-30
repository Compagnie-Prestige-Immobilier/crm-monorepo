import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart' hide FThemeBuildContext;
import 'package:go_router/go_router.dart';

import '../api.dart';
import '../models.dart';
import '../queries.dart';
import '../session.dart';
import '../ui.dart';

const _gutter = EdgeInsets.symmetric(horizontal: Insets.page);

class IntroScreen extends ConsumerStatefulWidget {
  const IntroScreen({super.key});
  @override
  ConsumerState<IntroScreen> createState() => _IntroState();
}

class _IntroState extends ConsumerState<IntroScreen> {
  final _page = PageController();
  int _i = 0;
  static const _slides = [
    ('Trouvez un atelier près de chez vous', 'Des couturiers vérifiés, par région et par spécialité.'),
    ('Contactez-le en un geste', 'Appel, WhatsApp ou demande directe, sans intermédiaire.'),
    ('Gérez votre atelier', 'Clients, mesures, commandes et acomptes, au même endroit.'),
  ];

  Future<void> _done() async {
    await ref.read(introSeenProvider.notifier).set('1');
    if (mounted) context.go('/bienvenue');
  }

  @override
  Widget build(BuildContext context) => AppScaffold(
    actions: [AppButton('Passer', variant: AppButtonVariant.ghost, onPressed: _done)],
    bottom: Row(children: [
      for (var i = 0; i < _slides.length; i++)
        AnimatedContainer(duration: Motion.base, margin: const EdgeInsets.only(right: Insets.sm), width: i == _i ? Insets.page : Insets.sm, height: Insets.sm,
          decoration: BoxDecoration(color: i == _i ? context.colors.onSurface : context.tones.hairline, borderRadius: Radii.full)),
      const Spacer(),
      AppButton(_i == _slides.length - 1 ? 'Commencer' : 'Suivant', onPressed: () => _i == _slides.length - 1 ? _done() : _page.nextPage(duration: Motion.enter, curve: Curves.easeOutCubic)),
    ]),
    body: PageView.builder(
      controller: _page, itemCount: _slides.length, onPageChanged: (i) => setState(() => _i = i),
      itemBuilder: (_, i) => Padding(padding: _gutter, child: Column(children: [
        const Spacer(flex: 2),
        Text(_slides[i].$1, style: context.text.displayLarge, textAlign: TextAlign.center),
        const SizedBox(height: Insets.lg),
        Text(_slides[i].$2, style: context.text.bodyLarge!.copyWith(color: context.tones.inkSecondary), textAlign: TextAlign.center),
        const Spacer(flex: 3),
      ])),
    ),
  );
}

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key, this.next});
  final String? next;
  String get _query => next == null ? '' : '?next=${Uri.encodeQueryComponent(next!)}';
  @override
  Widget build(BuildContext context) => AppScaffold(body: Padding(padding: const EdgeInsets.all(Insets.page), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    const Spacer(),
    Text('Gnawalma', style: context.text.displayLarge, textAlign: TextAlign.center),
    const SizedBox(height: Insets.sm),
    Text('Les ateliers de couture du Sénégal.', style: context.text.bodyLarge!.copyWith(color: context.tones.inkSecondary), textAlign: TextAlign.center),
    const Spacer(),
    AppButton('Se connecter', onPressed: () => context.push('/connexion$_query')),
    const SizedBox(height: Insets.md),
    AppButton('Créer un compte', variant: AppButtonVariant.secondary, onPressed: () => context.push('/inscription$_query')),
    const SizedBox(height: Insets.md),
    AppButton('Explorer les ateliers sans compte', variant: AppButtonVariant.ghost, onPressed: () => context.go('/client')),
  ])));
}

class _FormCard extends StatelessWidget {
  const _FormCard({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => AppCard(padding: const EdgeInsets.all(Insets.page), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children));
}

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.next, this.initial});
  final String? next;
  // Identifiant déjà connu : venu d'un compte existant repéré à l'inscription.
  final String? initial;
  @override
  ConsumerState<LoginScreen> createState() => _LoginState();
}

class _LoginState extends ConsumerState<LoginScreen> {
  final _id = TextEditingController();
  bool _email = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    if (initial != null) return _prefill(initial);
    lastIdentifier().then((v) { if (v != null && mounted && _id.text.isEmpty) setState(() => _prefill(v)); });
  }

  void _prefill(String v) {
    _email = v.contains('@');
    _id.text = _email ? v : formatPhone(v);
  }

  @override
  void dispose() { _id.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => AppScaffold(title: 'Connexion', body: ListView(padding: _gutter, children: [
    _FormCard(children: [
      _IdentifierField(controller: _id, email: _email, error: _error, onSubmitted: (_) => _next(), onChanged: (_) { if (_error != null) setState(() => _error = null); },
        onToggle: () => setState(() { _email = !_email; _id.clear(); _error = null; })),
    ]),
    const SizedBox(height: Insets.xl),
    AppButton('Continuer', onPressed: _next),
    const SizedBox(height: Insets.md),
    AppButton('Code oublié ?', variant: AppButtonVariant.ghost, onPressed: () => _forgot(context)),
  ]));

  void _next() {
    final err = _email ? emailError(_id.text) : phoneError(_id.text);
    if (err != null) return setState(() => _error = err);
    final identifier = _identifier(_id.text, email: _email);
    Navigator.push(context, MaterialPageRoute(builder: (_) => PinScreen(
      title: 'Votre code',
      onSubmit: (pin) => ref.read(apiProvider).auth('/auth/login', {'identifier': identifier, 'pin': pin}),
      onSuccess: (data) => _signedIn(ref, context, data, widget.next),
    )));
  }

  void _forgot(BuildContext context) => showAppSheet(context, title: 'Code oublié', child: _ForgotSheet(initial: _email ? _id.text : ''));
}

String _identifier(String text, {required bool email}) => email ? text.trim().toLowerCase() : phoneE164(text)!;

/// Numéro d'abord, e-mail en repli : la plupart des comptes n'ont pas d'adresse.
class _IdentifierField extends StatelessWidget {
  const _IdentifierField({required this.controller, required this.email, required this.onToggle, this.error, this.onSubmitted, this.onChanged});
  final TextEditingController controller;
  final bool email;
  final VoidCallback onToggle;
  final String? error;
  final ValueChanged<String>? onSubmitted, onChanged;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    email
      ? AppField(label: 'E-mail', controller: controller, hint: 'vous@exemple.sn', keyboardType: TextInputType.emailAddress, autofocus: true, error: error, textInputAction: TextInputAction.done, onSubmitted: onSubmitted, onChanged: onChanged)
      : AppPhoneField(controller: controller, autofocus: true, error: error, textInputAction: TextInputAction.done, onSubmitted: onSubmitted, onChanged: onChanged),
    const SizedBox(height: Insets.sm),
    AppButton(email ? 'Utiliser mon numéro' : 'Utiliser un e-mail', variant: AppButtonVariant.ghost, onPressed: onToggle),
  ]);
}

Future<void> _signedIn(WidgetRef ref, BuildContext context, Map<String, dynamic> data, String? next) async {
  final user = User.fromJson(data['user']);
  // Les listes lues en invité ignorent favoris et can_review : elles ne doivent pas survivre à la connexion.
  clearCache();
  await ref.read(sessionProvider.notifier).set(data['access_token'], user);
  await rememberIdentifier(user.identifier);
  _replayPendingContacts(ref).ignore();
  if (!context.mounted) return;
  context.go(next ?? (user.isAtelier ? '/atelier/commandes' : '/client'));
  if (data['deletion_cancelled'] == true) toast(context, 'Suppression annulée, bon retour.');
}

/// Appels passés sans compte : la trace part une fois le compte en place, les échecs sont abandonnés.
Future<void> _replayPendingContacts(WidgetRef ref) async {
  final api = ref.read(apiProvider);
  var sent = false;
  for (final entry in await takePendingContacts()) {
    final c = parsePendingContact(entry);
    if (c == null) continue;
    try { await api.post('/ateliers/${c.atelierId}/contacts', {'channel': c.channel}); sent = true; } catch (_) {}
  }
  if (sent) invalidate({'contacts', 'atelier'});
}

class _ForgotSheet extends ConsumerStatefulWidget {
  const _ForgotSheet({required this.initial});
  final String initial;
  @override
  ConsumerState<_ForgotSheet> createState() => _ForgotState();
}

class _ForgotState extends ConsumerState<_ForgotSheet> {
  late final _email = TextEditingController(text: widget.initial.contains('@') ? widget.initial : '');
  bool _busy = false;
  String? _error;
  @override
  void dispose() { _email.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Text('La réinitialisation passe par e-mail. Les comptes créés avec un numéro doivent contacter le support.', style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary)),
    const SizedBox(height: Insets.lg),
    AppField(label: 'E-mail', controller: _email, keyboardType: TextInputType.emailAddress, error: _error, hint: 'vous@exemple.sn'),
    const SizedBox(height: Insets.xl),
    AppButton('Envoyer le lien', loading: _busy, onPressed: () async {
      final err = emailError(_email.text);
      if (err != null) return setState(() => _error = err);
      setState(() { _busy = true; _error = null; });
      try {
        await ref.read(apiProvider).auth('/auth/mot-de-passe-oublie', {'email': _email.text.trim()});
        if (context.mounted) { popSheet(context); toast(context, 'Si un compte existe, un lien a été envoyé.'); }
      } on ApiException catch (e) {
        if (context.mounted) toast(context, e.message);
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    }),
    const SizedBox(height: Insets.sm),
    AppButton('Contacter le support', variant: AppButtonVariant.ghost, onPressed: () { popSheet(context); supportSheet(context, version: ''); }),
  ]);
}

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key, this.next, this.role});
  final String? next, role;
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterState();
}

class _RegisterState extends ConsumerState<RegisterScreen> {
  final _name = TextEditingController(), _id = TextEditingController();
  int _step = 1;
  bool _email = false, _conflict = false;
  String? _error;

  void _back() => setState(() => _step = _step == 4 && _email ? 2 : _step - 1);

  @override
  void dispose() {
    _name.dispose();
    _id.dispose();
    super.dispose();
  }

  void _next() {
    final err = _step == 1
      ? (_name.text.trim().length < 2 ? 'Votre nom est requis.' : null)
      : _email ? emailError(_id.text) : phoneError(_id.text);
    if (err != null) return setState(() => _error = err);
    setState(() => _error = null);
    if (_step == 1) return setState(() => _step = 2);
    // Un e-mail se relit à l'écran : seul le numéro passe par la confirmation.
    _email ? _confirmed() : setState(() => _step = 3);
  }

  // Rôle déjà connu (« Ouvrir mon atelier ») : on saute la question.
  void _confirmed() => widget.role != null ? _chooseRole(widget.role!) : setState(() => _step = 4);

  /// Le code est choisi une seule fois, montré en clair, puis récapitulé avant l'envoi.
  Future<void> _chooseRole(String role) async {
    final pin = await Navigator.push<String>(context, MaterialPageRoute(builder: (_) => PinScreen(
      title: 'Choisissez un code',
      subtitle: '4 à 8 chiffres. C\'est votre mot de passe.',
      reveal: true,
      onSubmit: (pin) async => {'pin': pin},
      onSuccess: (chosen) async => Navigator.pop(context, chosen['pin'] as String),
    )));
    if (pin == null || !mounted) return;
    final identifier = await Navigator.push<String>(context, MaterialPageRoute(builder: (_) => _PinRecap(pin: pin, submit: () => _register(role, pin))));
    if (identifier != null && mounted) setState(() { _step = 2; _error = identifier; _conflict = identifier.contains('existe déjà'); });
  }

  /// Renvoie l'erreur sur l'identifiant : elle se corrige deux écrans en arrière, les autres restent sur le récapitulatif.
  Future<String?> _register(String role, String pin) async {
    try {
      final data = await ref.read(apiProvider).auth('/auth/register', {'name': _name.text.trim(), 'identifier': _identifier(_id.text, email: _email), 'pin': pin, 'role': role});
      if (mounted) await _signedIn(ref, context, data, widget.next);
      return null;
    } on ApiException catch (e) {
      final identifier = e.field('identifier');
      if (mounted) toast(context, identifier ?? e.message);
      return identifier;
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = context.text.displayMedium;
    return PopScope(
      canPop: _step == 1,
      onPopInvokedWithResult: (didPop, _) { if (!didPop) _back(); },
      child: AppScaffold(
      onBack: _step > 1 ? _back : null,
      bottom: _step > 2 ? null : AppButton('Continuer', onPressed: _next),
      body: AnimatedSwitcher(
        duration: Motion.base,
        transitionBuilder: (child, anim) => FadeTransition(
          opacity: anim,
          child: SlideTransition(position: Tween<Offset>(begin: const Offset(0.06, 0), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)), child: child),
        ),
        child: switch (_step) {
          1 => ListView(key: const ValueKey(1), padding: _gutter, children: [
            const SizedBox(height: Insets.xl),
            Text('Comment vous appelez-vous ?', style: title),
            const SizedBox(height: Insets.xxl),
            AppField(label: 'Nom complet', controller: _name, autofocus: true, error: _error, textInputAction: TextInputAction.done, onSubmitted: (_) => _next()),
          ]),
          2 => ListView(key: const ValueKey(2), padding: _gutter, children: [
            const SizedBox(height: Insets.xl),
            Text(_email ? 'Votre e-mail ?' : 'Votre numéro de téléphone ?', style: title),
            const SizedBox(height: Insets.xxl),
            _IdentifierField(controller: _id, email: _email, error: _error, onSubmitted: (_) => _next(), onToggle: () => setState(() { _email = !_email; _id.clear(); _error = null; _conflict = false; })),
            if (_conflict) ...[
              const SizedBox(height: Insets.lg),
              AppButton(_email ? 'Se connecter avec cet e-mail' : 'Se connecter avec ce numéro', variant: AppButtonVariant.secondary,
                onPressed: () => context.push('/connexion?identifiant=${Uri.encodeQueryComponent(_identifier(_id.text, email: _email))}')),
            ],
          ]),
          3 => ListView(key: const ValueKey(3), padding: _gutter, children: [
            const SizedBox(height: Insets.xl),
            Text('C\'est bien ce numéro ?', style: title),
            const SizedBox(height: Insets.xxl),
            Text(prettyPhone(phoneE164(_id.text) ?? ''), style: context.text.displayLarge, textAlign: TextAlign.center),
            const SizedBox(height: Insets.xxl),
            AppButton('Oui, continuer', onPressed: _confirmed),
            const SizedBox(height: Insets.md),
            AppButton('Corriger', variant: AppButtonVariant.secondary, onPressed: () => setState(() => _step = 2)),
          ]),
          _ => ListView(key: const ValueKey(4), padding: _gutter, children: [
            const SizedBox(height: Insets.xl),
            Text('Vous êtes ?', style: title),
            const SizedBox(height: Insets.xxl),
            _RoleCard(icon: FIcons.scissors, title: 'Je suis couturier', subtitle: 'Je gère un atelier de couture', onTap: () => _chooseRole('atelier')),
            const SizedBox(height: Insets.lg),
            _RoleCard(icon: FIcons.search, title: 'Je cherche un couturier', subtitle: 'Je veux trouver un atelier près de moi', onTap: () => _chooseRole('client')),
          ]),
        },
      ),
    ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({required this.icon, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => AppCard(onTap: onTap, padding: const EdgeInsets.all(Insets.xl), child: Row(children: [
    Icon(icon, size: 28, color: context.colors.onSurface),
    const SizedBox(width: Insets.lg),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: context.text.titleMedium),
      const SizedBox(height: Insets.xs),
      Text(subtitle, style: context.text.bodySmall!.copyWith(color: context.tones.inkSecondary)),
    ])),
    Icon(FIcons.chevronRight, color: context.tones.inkTertiary),
  ]));
}

/// Dernier écran avant l'inscription : le code reste lisible le temps de le noter.
class _PinRecap extends StatefulWidget {
  const _PinRecap({required this.pin, required this.submit});
  final String pin;
  final Future<String?> Function() submit;
  @override
  State<_PinRecap> createState() => _PinRecapState();
}

class _PinRecapState extends State<_PinRecap> {
  bool _busy = false;

  Future<void> _confirm() async {
    setState(() => _busy = true);
    final identifier = await widget.submit();
    if (!mounted) return;
    setState(() => _busy = false);
    if (identifier != null) Navigator.pop(context, identifier);
  }

  @override
  Widget build(BuildContext context) => AppScaffold(
    bottom: AppButton('C\'est noté', loading: _busy, onPressed: _confirm),
    body: Padding(padding: _gutter, child: Column(children: [
      const Spacer(),
      Text('Votre code', style: context.text.headlineMedium, textAlign: TextAlign.center),
      const SizedBox(height: Insets.lg),
      Text(widget.pin, style: context.text.displayLarge!.copyWith(letterSpacing: 8), textAlign: TextAlign.center),
      const SizedBox(height: Insets.lg),
      Text('Notez-le bien, il sert à chaque connexion.', style: context.text.bodyLarge!.copyWith(color: context.tones.inkSecondary), textAlign: TextAlign.center),
      const Spacer(),
    ])),
  );
}

/// Pavé numérique dessiné, plein écran. Jamais le clavier système.
class PinScreen extends StatefulWidget {
  const PinScreen({super.key, required this.title, this.subtitle, required this.onSubmit, required this.onSuccess, this.reveal = false});
  final String title;
  final String? subtitle;
  final Future<Map<String, dynamic>> Function(String pin) onSubmit;
  final Future<void> Function(Map<String, dynamic> data) onSuccess;
  // Un code que l'on choisit se lit : les points ne servent qu'à masquer un code connu.
  final bool reveal;
  @override
  State<PinScreen> createState() => _PinState();
}

class _PinState extends State<PinScreen> with SingleTickerProviderStateMixin {
  String _pin = '';
  String? _error;
  bool _busy = false;
  int _fails = 0, _lockSeconds = 0;
  late final _shake = AnimationController(vsync: this, duration: Motion.base);

  @override
  void dispose() { _shake.dispose(); super.dispose(); }

  void _tap(String k) {
    if (_busy || _lockSeconds > 0) return;
    HapticFeedback.selectionClick();
    setState(() {
      _error = null;
      if (k == '⌫') {
        if (_pin.isNotEmpty) _pin = _pin.substring(0, _pin.length - 1);
      } else if (_pin.length < 8) {
        _pin += k;
      }
    });
  }

  Future<void> _submit() async {
    if (_pin.length < 4) return setState(() => _error = 'Au moins 4 chiffres.');
    setState(() => _busy = true);
    try {
      await widget.onSuccess(await widget.onSubmit(_pin));
    } on ApiException catch (e) {
      _shake.forward(from: 0);
      HapticFeedback.heavyImpact();
      if (!e.local) _fails++;
      setState(() {
        _pin = '';
        _error = e.field('pin') ?? e.field('identifier') ?? e.message;
        if (e.status == 429) {
          _lock(30);
        } else if (!e.local && _fails >= 3 && _fails < 5) {
          _error = '$_error Plus que ${5 - _fails} essai${5 - _fails > 1 ? 's' : ''}.';
        }
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _lock(int s) {
    _lockSeconds = s;
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (!mounted) return false;
      setState(() => _lockSeconds--);
      return _lockSeconds > 0;
    }).then((_) { _fails = 0; });
  }

  Widget _entry(BuildContext context) {
    if (widget.reveal) {
      return Semantics(liveRegion: true, child: ConstrainedBox(constraints: const BoxConstraints(minHeight: 40), child: Center(child: Text(_pin, style: context.text.displayLarge!.copyWith(letterSpacing: 8)))));
    }
    return Semantics(label: '${_pin.length} chiffres saisis', liveRegion: true, excludeSemantics: true, child: Row(mainAxisAlignment: MainAxisAlignment.center, spacing: Insets.md, children: [
      for (var i = 0; i < 8; i++) if (i < 4 || i < _pin.length) AnimatedContainer(duration: Motion.fast, width: 14, height: 14,
        decoration: BoxDecoration(shape: BoxShape.circle, color: i < _pin.length ? context.colors.onSurface : Colors.transparent, border: Border.all(color: context.colors.onSurface, width: 1.5))),
    ]));
  }

  @override
  Widget build(BuildContext context) => AppScaffold(body: Column(children: [
    const Spacer(),
    Padding(padding: _gutter, child: Column(children: [
      Text(widget.title, style: context.text.headlineMedium, textAlign: TextAlign.center),
      if (widget.subtitle != null) ...[const SizedBox(height: Insets.sm), Text(widget.subtitle!, style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary), textAlign: TextAlign.center)],
    ])),
    const SizedBox(height: Insets.xxl),
    AnimatedBuilder(animation: _shake, builder: (_, child) => Transform.translate(offset: Offset(12 * (0.5 - (_shake.value * 4 % 1 - 0.5).abs()) * (1 - _shake.value), 0), child: child),
      child: _entry(context)),
    ConstrainedBox(constraints: const BoxConstraints(minHeight: Insets.xxxl), child: Center(child: Semantics(liveRegion: true, child: Text(
      _lockSeconds > 0 ? 'Trop d\'essais. Réessayez dans $_lockSeconds s.' : _error ?? '',
      style: context.text.bodyMedium!.copyWith(color: context.tones.danger), textAlign: TextAlign.center,
    )))),
    const Spacer(),
    Column(spacing: Insets.md, children: [
      for (final row in const [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', '⌫']])
        Row(mainAxisAlignment: MainAxisAlignment.center, spacing: Insets.md, children: [
          for (final k in row) _Key(k, onTap: k.isEmpty ? null : () => _tap(k)),
        ]),
    ]),
    Padding(padding: const EdgeInsets.all(Insets.page), child: AppButton('Valider', loading: _busy, onPressed: _pin.length >= 4 && _lockSeconds == 0 ? _submit : null)),
  ]));
}

class _Key extends StatelessWidget {
  const _Key(this.label, {this.onTap});
  final String label;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    if (onTap == null) return const SizedBox(width: 88, height: 72);
    const box = BoxConstraints(minWidth: 88, minHeight: 72);
    if (label != '⌫') {
      return ConstrainedBox(constraints: box, child: FittedBox(child: AppButton(label, variant: AppButtonVariant.secondary, onPressed: onTap, size: 72)));
    }
    return Semantics(
      label: 'Effacer le dernier chiffre', button: true, onTap: onTap, excludeSemantics: true,
      child: ConstrainedBox(constraints: box, child: FButton(variant: FButtonVariant.outline, onPress: onTap, mainAxisSize: MainAxisSize.min, child: const Icon(FIcons.delete))),
    );
  }
}

/// Suppression de compte, côté client comme côté atelier : accord, code, puis session vidée.
Future<void> deleteAccountFlow(BuildContext context, WidgetRef ref) async {
  final proceed = await confirm(
    context, title: 'Supprimer mon compte ?',
    message: 'La suppression a lieu dans 7 jours. Reconnectez-vous avant la fin du délai pour l\'annuler. Passé ce délai, vos données seront définitivement perdues.',
    action: 'Continuer', danger: true,
  );
  if (!proceed || !context.mounted) return;
  final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (ctx) => PinScreen(
    title: 'Confirmer avec votre code',
    subtitle: 'Saisissez votre code pour supprimer votre compte.',
    // Le serveur répond 204 sans corps.
    onSubmit: (pin) async { await ref.read(apiProvider).delete('/auth/me', {'pin': pin}); return const {}; },
    onSuccess: (_) async => Navigator.of(ctx).pop(true),
  )));
  if (ok != true) return;
  clearCache();
  await ref.read(sessionProvider.notifier).clear();
  if (!context.mounted) return;
  context.go('/bienvenue');
  toast(context, 'Compte supprimé dans 7 jours. Reconnectez-vous avant pour annuler.');
}

class ResetPinScreen extends ConsumerWidget {
  const ResetPinScreen({super.key, required this.email, required this.token});
  final String email, token;
  @override
  Widget build(BuildContext context, WidgetRef ref) => PinScreen(
    title: 'Nouveau code',
    subtitle: email,
    // Le serveur répond 204 sans corps.
    onSubmit: (pin) => ref.read(apiProvider).auth('/auth/reinitialiser', {'email': email, 'token': token, 'pin': pin}).catchError((_) => <String, dynamic>{}, test: (e) => e is TypeError),
    onSuccess: (_) async {
      toast(context, 'Code modifié. Connectez-vous.');
      context.go('/connexion');
    },
  );
}
