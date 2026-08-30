import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../core/network/api_exception.dart';
import '../../../data/services/app_space.dart';
import '../../../data/services/storage_service.dart';
import '../../../routes/app_routes.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_assets.dart';
import '../../../shared/widgets/buttons/animated_primary_button.dart';
import '../../../shared/widgets/forms/validated_text_form_field.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../controllers/auth_controller.dart';
import '../domain/auth_input_validation.dart';
import '../domain/auth_session.dart';
import '../../../shared/theme/app_motion.dart';

class AuthView extends ConsumerStatefulWidget {
  const AuthView({super.key});

  @override
  ConsumerState<AuthView> createState() => _AuthViewState();
}

class _AuthViewState extends ConsumerState<AuthView>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _displayNameController = TextEditingController();
  final _identifierController = TextEditingController();
  final _pinController = TextEditingController();
  final _displayNameFocus = FocusNode();
  final _identifierFocus = FocusNode();
  final _pinFocus = FocusNode();

  late final AnimationController _shakeController;

  bool _registerMode = false;
  bool _hidePin = true;
  bool _showFormErrors = false;
  String? _roleError;
  AppSpace _space = AppSpace.client;

  // Last rendered validity of each field, so a keystroke that changes nothing
  // the user can see does not rebuild the screen.
  bool _lastDisplayNameValid = false;
  bool _lastIdentifierValid = false;
  bool _lastPinValid = false;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: AppMotion.slow,
    );
    _displayNameController.addListener(_onFormChanged);
    _identifierController.addListener(_onFormChanged);
    _pinController.addListener(_onFormChanged);
    _loadSpace();
  }

  Future<void> _loadSpace() async {
    final activeSpace = await StorageService().activeSpace;
    if (!mounted) return;
    setState(() => _space = activeSpace ?? AppSpace.client);
  }

  /// Rebuilds only when something the screen shows has actually changed.
  ///
  /// The three controllers each notify on every keystroke, and this rebuilt the
  /// whole screen every time — three `AnimatedSwitcher`s, the space header, the
  /// mode toggle and both illustrations — to recompute three booleans that
  /// change two or three times per field in total. Typing quickly, or holding
  /// backspace, queued far more full rebuilds than frames available.
  ///
  /// The validity badges genuinely do depend on the text, so the rebuild cannot
  /// simply be removed; it is gated on the derived state instead, which is what
  /// the screen actually renders.
  void _onFormChanged() {
    if (!mounted) return;
    final displayNameValid = _isDisplayNameValid;
    final identifierValid = _isIdentifierValid;
    final pinValid = _isPinValid;
    if (displayNameValid == _lastDisplayNameValid &&
        identifierValid == _lastIdentifierValid &&
        pinValid == _lastPinValid &&
        _roleError == null) {
      return;
    }
    setState(() {
      _lastDisplayNameValid = displayNameValid;
      _lastIdentifierValid = identifierValid;
      _lastPinValid = pinValid;
      _roleError = null;
    });
  }

  @override
  void dispose() {
    _displayNameController.removeListener(_onFormChanged);
    _identifierController.removeListener(_onFormChanged);
    _pinController.removeListener(_onFormChanged);
    _displayNameController.dispose();
    _identifierController.dispose();
    _pinController.dispose();
    _displayNameFocus.dispose();
    _identifierFocus.dispose();
    _pinFocus.dispose();
    _shakeController.dispose();
    super.dispose();
  }

  bool get _isDisplayNameValid =>
      !_registerMode ||
      AuthInputValidation.isDisplayNameValid(_displayNameController.text);

  bool get _isIdentifierValid =>
      AuthInputValidation.isIdentifierValid(_identifierController.text);

  bool get _isPinValid => AuthInputValidation.isPinValid(_pinController.text);

  bool get _isFormComplete =>
      _isDisplayNameValid && _isIdentifierValid && _isPinValid;

  @override
  Widget build(BuildContext context) {
    final action = ref.watch(authActionControllerProvider);
    final isLoading = action.isLoading;
    final error =
        _roleError ?? (action.hasError ? _friendlyError(action.error) : null);
    final isAtelier = _space == AppSpace.atelier;
    final colorScheme = Theme.of(context).colorScheme;
    final accent = isAtelier ? colorScheme.primary : colorScheme.secondary;

    return Scaffold(
      backgroundColor: context.backgroundColor,
      body: SafeArea(
        // Top-aligned, not centered. Vertically centering the form left a tall
        // dead band above the logo on a phone-height screen — the "what is this
        // empty space for" gap. Login screens start at the top; only the CTA
        // and its helpers sit lower.
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter,
                AppSpacing.xs,
                AppSpacing.gutter,
                0,
              ),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: Row(
                    children: [
                      IconButton(
                        tooltip: 'Retour au choix de l’espace',
                        onPressed: isLoading
                            ? null
                            : () =>
                                  AppNavigator.offAll(AppRoutes.spaceSelector),
                        icon: const Icon(Icons.arrow_back_rounded),
                      ),
                      const Spacer(),
                      _SpaceBadge(isAtelier: isAtelier, accent: accent),
                    ],
                  ),
                ),
              ),
            ),
            Expanded(
              child: Align(
                alignment: Alignment.topCenter,
                child: SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.gutter,
                    AppSpacing.md,
                    AppSpacing.gutter,
                    AppSpacing.xl,
                  ),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 520),
                    child: AutofillGroup(
                      child: Form(
                        key: _formKey,
                        child: AnimatedBuilder(
                          animation: _shakeController,
                          builder: (context, child) {
                            final reduceMotion = MediaQuery.disableAnimationsOf(
                              context,
                            );
                            final offset = reduceMotion
                                ? 0.0
                                : math.sin(
                                        _shakeController.value * math.pi * 6,
                                      ) *
                                      (1 - _shakeController.value) *
                                      8;
                            return Transform.translate(
                              offset: Offset(offset, 0),
                              child: child,
                            );
                          },
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // Bare logo, no container. A logo floated inside a
                              // white rounded-square with a drop shadow reads as an
                              // app-store icon dropped mid-screen — the reference
                              // apps (Instagram, Revolut, Wise) all set the mark
                              // directly on the page.
                              Align(
                                alignment: Alignment.centerLeft,
                                child: Hero(
                                  tag: 'app_logo',
                                  child: Image.asset(
                                    AppAssets.logo,
                                    width: 52,
                                    height: 52,
                                    semanticLabel: 'Gnawalma',
                                    errorBuilder:
                                        (context, error, stackTrace) => Icon(
                                          Icons.storefront_rounded,
                                          size: 52,
                                          color: context.textSecondaryColor,
                                        ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 30),
                              AnimatedSwitcher(
                                duration: AppMotion.quick,
                                switchInCurve: Curves.easeOutCubic,
                                switchOutCurve: Curves.easeInCubic,
                                child: Column(
                                  key: ValueKey(_registerMode),
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _registerMode
                                          ? 'Créer votre compte'
                                          : 'Bienvenue sur Gnawalma',
                                      textAlign: TextAlign.start,
                                      style: AppTextStyles.h1.copyWith(
                                        color: context.textPrimaryColor,
                                        fontSize: 34,
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    Text(
                                      _registerMode
                                          ? (isAtelier
                                                ? 'Créez votre accès professionnel pour sécuriser et synchroniser l’activité de votre atelier.'
                                                : 'Créez votre espace client pour enregistrer vos favoris et retrouver vos demandes.')
                                          : (isAtelier
                                                ? 'Retrouvez vos clients, commandes et paiements sur tous vos appareils.'
                                                : 'Retrouvez vos favoris et contactez des ateliers en toute simplicité.'),
                                      textAlign: TextAlign.start,
                                      style: AppTextStyles.bodyLarge.copyWith(
                                        color: context.textSecondaryColor,
                                        height: 1.45,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              // The illustration that used to fill this gap is
                              // gone: `knowledge-base/DESIGN.md` scopes
                              // illustrations to empty states, and a sign-in
                              // form is not one. Removing it also shortens the
                              // scroll to the fields, which is the whole point
                              // of the screen.
                              const SizedBox(height: AppSpacing.lg),
                              _ModeSelector(
                                registerMode: _registerMode,
                                accent: accent,
                                onChanged: isLoading ? null : _setRegisterMode,
                              ),
                              const SizedBox(height: 24),
                              AnimatedSize(
                                duration: AppMotion.quick,
                                curve: Curves.easeOutCubic,
                                alignment: Alignment.topCenter,
                                child: _registerMode
                                    ? Column(
                                        children: [
                                          ValidatedTextFormField(
                                            controller: _displayNameController,
                                            focusNode: _displayNameFocus,
                                            labelText: 'Nom complet',
                                            hintText: 'Ex. Awa Diop',
                                            prefixIcon:
                                                Icons.person_outline_rounded,
                                            isValid: _isDisplayNameValid,
                                            textInputAction:
                                                TextInputAction.next,
                                            autofillHints: const [
                                              AutofillHints.name,
                                            ],
                                            enabled: !isLoading,
                                            validator: (value) {
                                              if (!_registerMode) return null;
                                              if ((value ?? '').trim().length <
                                                  2) {
                                                return 'Saisissez au moins deux caractères.';
                                              }
                                              return null;
                                            },
                                            onFieldSubmitted: (_) =>
                                                _identifierFocus.requestFocus(),
                                          ),
                                          const SizedBox(height: 16),
                                        ],
                                      )
                                    : const SizedBox.shrink(),
                              ),
                              ValidatedTextFormField(
                                controller: _identifierController,
                                focusNode: _identifierFocus,
                                labelText: 'Téléphone ou email',
                                hintText: '77 000 00 00 ou nom@email.com',
                                prefixIcon: Icons.alternate_email_rounded,
                                isValid: _isIdentifierValid,
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                                autofillHints: const [
                                  AutofillHints.email,
                                  AutofillHints.telephoneNumber,
                                ],
                                enabled: !isLoading,
                                validator: (_) =>
                                    _identifierValidationMessage(),
                                onFieldSubmitted: (_) =>
                                    _pinFocus.requestFocus(),
                              ),
                              const SizedBox(height: 16),
                              ValidatedTextFormField(
                                controller: _pinController,
                                focusNode: _pinFocus,
                                labelText: 'Code PIN',
                                hintText: '4 à 8 chiffres',
                                prefixIcon: Icons.lock_outline_rounded,
                                isValid: _isPinValid,
                                obscureText: _hidePin,
                                keyboardType: TextInputType.number,
                                textInputAction: TextInputAction.done,
                                autofillHints: const [AutofillHints.password],
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                  LengthLimitingTextInputFormatter(8),
                                ],
                                enabled: !isLoading,
                                trailing: IconButton(
                                  tooltip: _hidePin
                                      ? 'Afficher le PIN'
                                      : 'Masquer le PIN',
                                  onPressed: isLoading
                                      ? null
                                      : () => setState(
                                          () => _hidePin = !_hidePin,
                                        ),
                                  icon: Icon(
                                    _hidePin
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                  ),
                                ),
                                validator: (value) {
                                  final pin = value ?? '';
                                  if (!RegExp(r'^\d{4,8}$').hasMatch(pin)) {
                                    return 'Le PIN doit contenir 4 à 8 chiffres.';
                                  }
                                  return null;
                                },
                                onFieldSubmitted: (_) =>
                                    _attemptSubmit(isLoading),
                              ),
                              AnimatedSwitcher(
                                duration: AppMotion.quick,
                                child: error == null
                                    ? const SizedBox.shrink(
                                        key: ValueKey('no-error'),
                                      )
                                    : Padding(
                                        key: ValueKey(error),
                                        padding: const EdgeInsets.only(top: 16),
                                        child: AppStatusBanner(
                                          message: error,
                                          icon: Icons.error_outline_rounded,
                                          tone: AppStatusTone.error,
                                        ),
                                      ),
                              ),
                              const SizedBox(height: 22),
                              AnimatedPrimaryButton(
                                label: _registerMode
                                    ? 'Créer le compte'
                                    : 'Se connecter',
                                enabled: _isFormComplete,
                                loading: isLoading,
                                backgroundColor: accent,
                                icon: _registerMode
                                    ? Icons.arrow_forward_rounded
                                    : Icons.login_rounded,
                                onPressed: _submit,
                              ),
                              AnimatedSwitcher(
                                duration: AppMotion.quick,
                                child: !_showFormErrors || _isFormComplete
                                    ? const SizedBox.shrink(
                                        key: ValueKey('form-ready-or-pristine'),
                                      )
                                    : Padding(
                                        key: const ValueKey('form-incomplete'),
                                        padding: const EdgeInsets.only(top: 10),
                                        child: Text(
                                          'Complétez les champs signalés pour continuer.',
                                          textAlign: TextAlign.center,
                                          style: AppTextStyles.caption.copyWith(
                                            color: colorScheme.error,
                                          ),
                                        ),
                                      ),
                              ),
                              const SizedBox(height: 18),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(
                                    Icons.lock_person_outlined,
                                    size: 17,
                                    color: context.textSecondaryColor,
                                  ),
                                  const SizedBox(width: 8),
                                  Flexible(
                                    child: Text(
                                      'Les données privées de l’atelier restent séparées du profil public de la marketplace.',
                                      textAlign: TextAlign.center,
                                      style: AppTextStyles.caption.copyWith(
                                        color: context.textSecondaryColor,
                                        height: 1.4,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _setRegisterMode(bool value) {
    HapticFeedback.selectionClick();
    setState(() {
      _registerMode = value;
      _roleError = null;
      _showFormErrors = false;
      ref.invalidate(authActionControllerProvider);
    });
    if (value && _displayNameController.text.trim().isEmpty) {
      _displayNameFocus.requestFocus();
    }
  }

  String? _identifierValidationMessage() =>
      AuthInputValidation.identifierError(_identifierController.text);

  Future<void> _attemptSubmit(bool isLoading) async {
    if (isLoading) return;
    if (_isFormComplete) {
      await _submit();
      return;
    }
    setState(() => _showFormErrors = true);
    _formKey.currentState?.validate();
    HapticFeedback.heavyImpact();
    if (!MediaQuery.disableAnimationsOf(context)) {
      await _shakeController.forward(from: 0);
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() => _showFormErrors = true);

    if (!_isFormComplete || !(_formKey.currentState?.validate() ?? false)) {
      HapticFeedback.heavyImpact();
      if (!MediaQuery.disableAnimationsOf(context)) {
        await _shakeController.forward(from: 0);
      }
      return;
    }

    HapticFeedback.mediumImpact();
    final controller = ref.read(authActionControllerProvider.notifier);
    final identifier = _identifierController.text.trim();
    final pin = _pinController.text;

    final AuthSession? session;
    if (_registerMode) {
      session = await controller.register(
        displayName: _displayNameController.text.trim(),
        identifier: identifier,
        pin: pin,
        role: _space == AppSpace.atelier ? 'atelier_owner' : 'client',
      );
    } else {
      session = await controller.signIn(identifier: identifier, pin: pin);
    }

    if (!mounted || session == null) return;

    // 'atelier_staff' was tested here and does not exist: the API issues
    // 'platform_admin', 'atelier_owner', 'atelier_manager' or 'client'
    // (apps/api/src/auth/auth.types.ts). An administrator matched neither
    // branch and was signed out with a message describing a different account
    // type than the one they hold.
    final roleMatchesSpace = _space == AppSpace.client
        ? session.role == 'client'
        : session.role == 'atelier_owner' || session.role == 'atelier_manager';
    if (!roleMatchesSpace) {
      final isAdmin = session.role == 'platform_admin';
      await controller.logout();
      if (!mounted) return;
      setState(() {
        _roleError = isAdmin
            ? 'Ce compte administrateur s’utilise depuis la console web, pas depuis l’application.'
            : _space == AppSpace.client
            ? 'Ce compte est professionnel. Revenez au choix d’espace pour ouvrir l’Atelier.'
            : 'Ce compte est un compte client. Revenez au choix d’espace pour ouvrir la marketplace.';
      });
      HapticFeedback.heavyImpact();
      return;
    }

    TextInput.finishAutofillContext();
    if (_space == AppSpace.atelier) {
      AppNavigator.offAll(
        session.ateliers.isEmpty ? AppRoutes.setupWizard : AppRoutes.shell,
      );
    } else {
      AppNavigator.offAll(AppRoutes.clientShell);
    }
  }

  String _friendlyError(Object? error) {
    if (error is ApiException) return error.message;
    return 'Impossible de terminer l’opération pour le moment.';
  }
}

class _SpaceBadge extends StatelessWidget {
  const _SpaceBadge({required this.isAtelier, required this.accent});

  final bool isAtelier;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(AppSpacing.radiusCircular),
        border: Border.all(color: accent.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isAtelier ? Icons.storefront_rounded : Icons.person_rounded,
            size: 17,
            color: accent,
          ),
          const SizedBox(width: 7),
          Text(
            isAtelier ? 'Espace Atelier' : 'Espace Client',
            style: AppTextStyles.caption.copyWith(
              color: accent,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _ModeSelector extends StatelessWidget {
  const _ModeSelector({
    required this.registerMode,
    required this.accent,
    required this.onChanged,
  });

  final bool registerMode;
  final Color accent;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Choisir entre connexion et création de compte',
      child: Container(
        // A hard 56 clipped both labels once the system text size was raised.
        // The track grows with the type instead, capped so it cannot become a
        // block at the largest accessibility sizes.
        height: MediaQuery.textScalerOf(
          context,
        ).clamp(maxScaleFactor: 1.6).scale(56),
        padding: const EdgeInsets.all(AppSpacing.xxs),
        decoration: BoxDecoration(
          color: context.surfaceLightColor,
          borderRadius: BorderRadius.circular(AppSpacing.radiusContainer),
          border: Border.all(
            color: context.borderColor.withValues(alpha: 0.65),
          ),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            return Stack(
              children: [
                AnimatedAlign(
                  duration: AppMotion.quick,
                  curve: Curves.easeOutCubic,
                  alignment: registerMode
                      ? Alignment.centerRight
                      : Alignment.centerLeft,
                  child: SizedBox(
                    width: constraints.maxWidth / 2,
                    height: double.infinity,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: context.surfaceColor,
                        borderRadius: BorderRadius.circular(
                          AppSpacing.radiusControl,
                        ),
                        border: Border.all(
                          color: accent.withValues(alpha: 0.14),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Theme.of(
                              context,
                            ).colorScheme.shadow.withValues(alpha: 0.05),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                Row(
                  children: [
                    Expanded(
                      child: _ModeButton(
                        label: 'Connexion',
                        selected: !registerMode,
                        accent: accent,
                        onTap: onChanged == null
                            ? null
                            : () => onChanged!(false),
                      ),
                    ),
                    Expanded(
                      child: _ModeButton(
                        label: 'Nouveau compte',
                        selected: registerMode,
                        accent: accent,
                        onTap: onChanged == null
                            ? null
                            : () => onChanged!(true),
                      ),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ModeButton extends StatelessWidget {
  const _ModeButton({
    required this.label,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final Color accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final baseStyle =
        Theme.of(context).textTheme.labelLarge ?? const TextStyle();
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Center(
          child: AnimatedDefaultTextStyle(
            duration: AppMotion.quick,
            style: baseStyle.copyWith(
              color: selected ? accent : context.textSecondaryColor,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
            ),
            child: Text(label),
          ),
        ),
      ),
    );
  }
}
