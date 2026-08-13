import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../auth_state.dart';

/// Écran de connexion.
///
/// Fond bordeaux plein et logo inversé (`cpi-header.png`) : c'est le seul écran
/// où la marque occupe toute la surface, et le seul où l'on peut se le
/// permettre — après, chaque pixel sert la saisie.
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
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    await ref
        .read(authControllerProvider.notifier)
        .signIn(
          identifier: _identifier.text.trim(),
          password: _password.text,
          staySignedIn: _staySignedIn,
        );
    // La redirection est faite par le garde de go_router : il connaît le
    // paramètre `next`, l'écran non.
  }

  @override
  Widget build(BuildContext context) {
    final AuthState auth = ref.watch(authControllerProvider);
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    const Color burgundy = Color(0xFF630210);

    // `colorScheme.error` (#B91C1C) ne fait que 2,10:1 sur le bordeaux : les
    // messages de validation étaient posés à même le fond plein de cet écran,
    // donc illisibles. `destructiveOnDark` (#F87171) passe à 4,91:1.
    final TextStyle errorStyle = (theme.textTheme.bodyMedium ?? const TextStyle())
        .copyWith(color: cpi.destructiveOnDark, fontWeight: FontWeight.w600);
    final OutlineInputBorder errorBorder = OutlineInputBorder(
      borderRadius: CpiRadius.brMd,
      borderSide: BorderSide(color: cpi.destructiveOnDark, width: 2),
    );

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: burgundy,
        systemNavigationBarIconBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: burgundy,
        body: SafeArea(
          child: LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              return SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: CpiSpacing.xl,
                  vertical: CpiSpacing.xxl,
                ),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: constraints.maxHeight - CpiSpacing.giant,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: <Widget>[
                      // Version inversée du logo, réservée aux fonds bordeaux.
                      // Dimensions imposées : sans `cacheWidth`, Flutter décode
                      // le PNG à sa taille native et garde le bitmap complet en
                      // mémoire — coûteux sur un appareil d'entrée de gamme.
                      Center(
                        child: Image.asset(
                          'assets/brand/cpi-header.png',
                          width: 196,
                          height: 80,
                          cacheWidth: 392,
                          fit: BoxFit.contain,
                          filterQuality: FilterQuality.medium,
                          semanticLabel: 'CPI',
                        ),
                      ),
                      const SizedBox(height: CpiSpacing.xs),
                      Text(
                        'Espace téléconseil',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: cpi.navForeground,
                        ),
                      ),
                      const SizedBox(height: CpiSpacing.xxxl),

                      Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: <Widget>[
                            _FieldLabel(text: 'Identifiant'),
                            const SizedBox(height: CpiSpacing.xs),
                            TextFormField(
                              controller: _identifier,
                              autofillHints: const <String>[AutofillHints.username],
                              textInputAction: TextInputAction.next,
                              keyboardType: TextInputType.text,
                              autocorrect: false,
                              enableSuggestions: false,
                              textCapitalization: TextCapitalization.none,
                              style: theme.textTheme.bodyLarge,
                              decoration: InputDecoration(
                                hintText: 'nom.prenom ou e-mail',
                                prefixIcon: const Icon(PhosphorIconsRegular.user),
                                fillColor: cpi.inputBackground,
                                errorStyle: errorStyle,
                                errorBorder: errorBorder,
                                focusedErrorBorder: errorBorder,
                              ),
                              validator: (String? value) =>
                                  (value == null || value.trim().isEmpty)
                                  ? 'Saisissez l\'identifiant.'
                                  : null,
                              onFieldSubmitted: (_) => _passwordFocus.requestFocus(),
                            ),
                            const SizedBox(height: CpiSpacing.md),

                            _FieldLabel(text: 'Mot de passe'),
                            const SizedBox(height: CpiSpacing.xs),
                            TextFormField(
                              controller: _password,
                              focusNode: _passwordFocus,
                              autofillHints: const <String>[AutofillHints.password],
                              obscureText: _obscure,
                              textInputAction: TextInputAction.done,
                              style: theme.textTheme.bodyLarge,
                              decoration: InputDecoration(
                                hintText: '••••••••',
                                prefixIcon: const Icon(PhosphorIconsRegular.lockKey),
                                fillColor: cpi.inputBackground,
                                suffixIcon: IconButton(
                                  onPressed: () => setState(() => _obscure = !_obscure),
                                  tooltip: _obscure
                                      ? 'Afficher le mot de passe'
                                      : 'Masquer le mot de passe',
                                  icon: Icon(
                                    _obscure
                                        ? PhosphorIconsRegular.eye
                                        : PhosphorIconsRegular.eyeSlash,
                                  ),
                                ),
                                errorStyle: errorStyle,
                                errorBorder: errorBorder,
                                focusedErrorBorder: errorBorder,
                              ),
                              validator: (String? value) =>
                                  (value == null || value.isEmpty)
                                  ? 'Saisissez le mot de passe.'
                                  : null,
                              onFieldSubmitted: (_) => _submit(),
                            ),

                            const SizedBox(height: CpiSpacing.xs),
                            _StaySignedInToggle(
                              value: _staySignedIn,
                              onChanged: (bool value) =>
                                  setState(() => _staySignedIn = value),
                            ),

                            if (auth.errorMessage != null) ...<Widget>[
                              const SizedBox(height: CpiSpacing.md),
                              _ErrorBanner(message: auth.errorMessage!),
                            ],

                            const SizedBox(height: CpiSpacing.xl),
                            FilledButton(
                              onPressed: auth.isSubmitting ? null : _submit,
                              style: FilledButton.styleFrom(
                                backgroundColor: cpi.accent,
                                foregroundColor: cpi.accentForeground,
                                disabledBackgroundColor: cpi.accent.withValues(
                                  alpha: CpiStateOpacity.disabledContainer,
                                ),
                                disabledForegroundColor: cpi.navForeground,
                              ),
                              child: auth.isSubmitting
                                  ? SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.5,
                                        color: cpi.accentForeground,
                                      ),
                                    )
                                  : const Text('Se connecter'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(
        context,
      ).textTheme.labelLarge?.copyWith(color: const Color(0xFFFFFFFF)),
    );
  }
}

class _StaySignedInToggle extends StatelessWidget {
  const _StaySignedInToggle({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final CpiColors cpi = context.cpi;
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: CpiRadius.brSm,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: CpiSpacing.xs),
        child: Row(
          children: <Widget>[
            SizedBox.square(
              dimension: 24,
              child: Checkbox(
                value: value,
                onChanged: (bool? v) => onChanged(v ?? false),
                side: BorderSide(color: cpi.navForeground, width: 2),
                fillColor: WidgetStateProperty.resolveWith<Color>((
                  Set<WidgetState> states,
                ) {
                  return states.contains(WidgetState.selected)
                      ? cpi.accent
                      : Colors.transparent;
                }),
                checkColor: cpi.accentForeground,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
            const SizedBox(width: CpiSpacing.sm),
            Expanded(
              child: Text(
                'Rester connecté sur cet appareil',
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: const Color(0xFFFFFFFF)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(CpiSpacing.sm),
      decoration: BoxDecoration(
        color: theme.colorScheme.errorContainer,
        borderRadius: CpiRadius.brMd,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(
            PhosphorIconsRegular.warningCircle,
            size: 18,
            color: theme.colorScheme.onErrorContainer,
          ),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Text(
              message,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onErrorContainer,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
