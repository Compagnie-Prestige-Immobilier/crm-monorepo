import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/connectivity.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../auth_state.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _identifier = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final FocusNode _passwordFocus = FocusNode();

  bool _staySignedIn = true;
  bool _obscure = true;

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (ref.read(authControllerProvider).isSubmitting) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    await ref
        .read(authControllerProvider.notifier)
        .signIn(
          identifier: _identifier.text.trim(),
          password: _password.text,
          staySignedIn: _staySignedIn,
        );
  }

  @override
  Widget build(BuildContext context) {
    final AuthState auth = ref.watch(authControllerProvider);
    final bool offline =
        ref.watch(connectivityProvider) != CpiConnectivity.online;
    final ThemeData theme = Theme.of(context);
    final bool dark = theme.brightness == Brightness.dark;
    final String? error = auth.errorMessage;

    // Un seul compte rendu à la fois : l'échec du dernier envoi prime sur la
    // note de réseau, qui n'en serait que la cause probable.
    final Widget? banner = switch ((error, offline)) {
      (final String message, _) => CpiStatusBand(
        text: message,
        tone: CpiTone.danger,
      ),
      (null, true) => const CpiStatusBand(
        text: 'Pas de réseau. Il en faut pour la première connexion.',
        tone: CpiTone.warning,
      ),
      _ => null,
    };

    return AnnotatedRegion<SystemUiOverlayStyle>(
      // L'écran n'est plus peint en marque : les icônes système doivent
      // contraster avec la surface neutre, claire ou sombre (WCAG 1.4.11).
      value: SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: dark ? Brightness.light : Brightness.dark,
        statusBarBrightness: dark ? Brightness.dark : Brightness.light,
        systemNavigationBarColor: theme.colorScheme.surface,
        systemNavigationBarIconBrightness: dark
            ? Brightness.light
            : Brightness.dark,
      ),
      child: CpiScaffold(
        title: 'Connexion',
        showTitle: false,
        banner: banner,
        footer: CpiActionBar(
          child: CpiButton(
            'Se connecter',
            loading: auth.isSubmitting,
            onPressed: () => unawaited(_submit()),
          ),
        ),
        body: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) =>
              SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  CpiSpacing.md,
                  CpiSpacing.lg,
                  CpiSpacing.md,
                  CpiSpacing.xl,
                ),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: constraints.maxHeight - CpiSpacing.huge,
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 480),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: <Widget>[
                          Center(
                            child: Image.asset(
                              // Le logo couleur est sur fond blanc opaque :
                              // sur la surface sombre il ferait une plaque.
                              // Le fichier d'en-tête est le même dessin
                              // détouré, en blanc.
                              dark
                                  ? 'assets/brand/cpi-header.png'
                                  : 'assets/brand/cpi-logo.png',
                              width: 120,
                              cacheWidth: 240,
                              fit: BoxFit.contain,
                              filterQuality: FilterQuality.medium,
                              semanticLabel: 'CPI',
                            ),
                          ),
                          const SizedBox(height: CpiSpacing.lg),
                          Semantics(
                            header: true,
                            child: Text(
                              'CPI GO',
                              textAlign: TextAlign.center,
                              style: theme.textTheme.titleLarge,
                            ),
                          ),
                          const SizedBox(height: CpiSpacing.xxs),
                          Text(
                            'Connectez-vous pour commencer',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(height: CpiSpacing.xxl),
                          Form(
                            key: _formKey,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: <Widget>[
                                FTextFormField(
                                  control: FTextFieldControl.managed(
                                    controller: _identifier,
                                  ),
                                  label: const Text('Identifiant'),
                                  hint: 'Votre identifiant',
                                  autofillHints: const <String>[
                                    AutofillHints.username,
                                  ],
                                  textInputAction: TextInputAction.next,
                                  keyboardType: TextInputType.text,
                                  autocorrect: false,
                                  enableSuggestions: false,
                                  validator: (String? value) =>
                                      (value == null || value.trim().isEmpty)
                                      ? 'Écrivez votre identifiant.'
                                      : null,
                                  onSubmit: (_) =>
                                      _passwordFocus.requestFocus(),
                                ),
                                const SizedBox(height: CpiSpacing.md),
                                FTextFormField(
                                  control: FTextFieldControl.managed(
                                    controller: _password,
                                  ),
                                  focusNode: _passwordFocus,
                                  label: const Text('Mot de passe'),
                                  hint: '••••••••',
                                  autofillHints: const <String>[
                                    AutofillHints.password,
                                  ],
                                  obscureText: _obscure,
                                  textInputAction: TextInputAction.done,
                                  suffixBuilder:
                                      (
                                        BuildContext _,
                                        FTextFieldStyle _,
                                        Set<FTextFieldVariant> _,
                                      ) => _ObscureToggle(
                                        obscured: _obscure,
                                        onPress: () => setState(
                                          () => _obscure = !_obscure,
                                        ),
                                      ),
                                  validator: (String? value) =>
                                      (value == null || value.isEmpty)
                                      ? 'Écrivez votre mot de passe.'
                                      : null,
                                  onSubmit: (_) => unawaited(_submit()),
                                ),
                                const SizedBox(height: CpiSpacing.xs),
                                _StaySignedInToggle(
                                  value: _staySignedIn,
                                  onChanged: (bool value) =>
                                      setState(() => _staySignedIn = value),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
        ),
      ),
    );
  }
}

/// Œil de révélation du mot de passe, posé dans le champ ForUI.
class _ObscureToggle extends StatelessWidget {
  const _ObscureToggle({required this.obscured, required this.onPress});

  final bool obscured;
  final VoidCallback onPress;

  @override
  Widget build(BuildContext context) => Semantics(
    label: obscured ? 'Afficher le mot de passe' : 'Masquer le mot de passe',
    button: true,
    excludeSemantics: true,
    child: ConstrainedBox(
      constraints: const BoxConstraints(
        minWidth: kCpiMinTouchTarget,
        minHeight: kCpiMinTouchTarget,
      ),
      child: FButton.icon(
        variant: FButtonVariant.ghost,
        onPress: onPress,
        child: Icon(
          obscured ? PhosphorIconsRegular.eye : PhosphorIconsRegular.eyeSlash,
          size: CpiIconSize.md,
        ),
      ),
    ),
  );
}

class _StaySignedInToggle extends StatelessWidget {
  const _StaySignedInToggle({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: kCpiMinTouchTarget),
      child: FCheckbox(
        value: value,
        onChange: onChanged,
        label: const Text('Rester connecté sur cet appareil'),
      ),
    );
  }
}
