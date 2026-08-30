import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/services/security_service.dart';
import '../../../modules/auth/controllers/auth_controller.dart';
import '../../../modules/auth/views/logout_confirmation.dart';
import '../../../shared/services/feedback_service.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/utils/app_logger.dart';
import '../../../routes/app_routes.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_assets.dart';
import '../../../shared/widgets/security/pin_dots.dart';
import '../../../shared/widgets/security/pin_numpad.dart';
import '../controllers/pin_code_provider.dart';
import '../../../shared/theme/app_motion.dart';

class PinCodeView extends ConsumerStatefulWidget {
  const PinCodeView({super.key, this.mode = 'auth'});

  final String mode;

  @override
  ConsumerState<PinCodeView> createState() => _PinCodeViewState();
}

class _PinCodeViewState extends ConsumerState<PinCodeView> {
  Timer? _lockoutTicker;
  bool _isRecovering = false;

  @override
  void dispose() {
    _lockoutTicker?.cancel();
    super.dispose();
  }

  /// The lockout expires on wall-clock time, not on any state change, so the
  /// pad needs its own tick to come back to life and to count down.
  void _syncLockoutTicker(DateTime? lockedUntil) {
    final locked = lockedUntil != null && DateTime.now().isBefore(lockedUntil);
    if (locked && _lockoutTicker == null) {
      _lockoutTicker = Timer.periodic(
        const Duration(seconds: 1),
        (_) => setState(() {}),
      );
    } else if (!locked && _lockoutTicker != null) {
      _lockoutTicker!.cancel();
      _lockoutTicker = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final mode = widget.mode;
    final state = ref.watch(pinCodeProvider(mode: mode));
    final notifier = ref.read(pinCodeProvider(mode: mode).notifier);
    final scheme = Theme.of(context).colorScheme;
    final lockedUntil = state.lockedUntil;
    final isLocked =
        lockedUntil != null && DateTime.now().isBefore(lockedUntil);

    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _syncLockoutTicker(lockedUntil),
    );

    return PopScope(
      // The lock screen is the gate to the workspace: back must not dismiss it.
      canPop: mode != 'auth',
      child: Scaffold(
        backgroundColor: context.backgroundColor,
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.xs,
                  AppSpacing.md,
                  0,
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Image.asset(
                          AppAssets.logo,
                          width: 30,
                          height: 30,
                          semanticLabel: 'Gnawalma',
                          errorBuilder: (context, _, _) => Icon(
                            Icons.shield_outlined,
                            size: 26,
                            color: context.textSecondaryColor,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Text(
                          'Gnawalma',
                          style: AppTextStyles.h5.copyWith(
                            color: context.textPrimaryColor,
                          ),
                        ),
                      ],
                    ),
                    // En mode « auth » l'écran est la porte de l'espace : le
                    // routeur y ramène tant que l'application est verrouillée,
                    // donc une flèche de retour y boucle. La sortie offerte est
                    // celle qui marche — changer de compte.
                    Align(
                      alignment: Alignment.centerLeft,
                      child: mode == 'auth'
                          ? IconButton(
                              tooltip: 'Se déconnecter',
                              onPressed: _isRecovering
                                  ? null
                                  : () => confirmLogout(
                                      context,
                                      ref,
                                      retainedTitle:
                                          'Ce qui reste sur l’appareil',
                                      retainedMessage:
                                          'Vos données locales sont conservées. Le code PIN sera redemandé après la prochaine connexion.',
                                    ),
                              icon: const Icon(Icons.logout_rounded),
                            )
                          : IconButton(
                              tooltip: 'Retour',
                              onPressed: () => AppNavigator.back(),
                              icon: const Icon(Icons.arrow_back_rounded),
                            ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final compact = constraints.maxHeight < 650;
                    return SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(
                        AppSpacing.lg,
                        compact ? AppSpacing.sm : 28,
                        AppSpacing.lg,
                        AppSpacing.xs,
                      ),
                      child: Column(
                        children: [
                          SizedBox(
                            height: compact ? AppSpacing.xs : AppSpacing.md,
                          ),
                          AnimatedSwitcher(
                            duration: AppMotion.quick,
                            child: Text(
                              state.title,
                              key: ValueKey(state.title),
                              style: AppTextStyles.h2.copyWith(
                                color: context.textPrimaryColor,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            _subtitleFor(
                              state.mode,
                              state.isConfirming,
                              isLocked,
                              lockedUntil,
                            ),
                            style: AppTextStyles.bodyMedium.copyWith(
                              color: context.textSecondaryColor,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          SizedBox(height: compact ? 28 : 44),
                          Semantics(
                            liveRegion: true,
                            label:
                                '${state.pin.length} chiffre(s) saisi(s) sur 4',
                            child: PinDots(
                              currentLength: state.pin.length,
                              color: scheme.onSurface,
                              size: 15,
                            ),
                          ),
                          if (state.failedAttempts > 0 && !isLocked) ...[
                            const SizedBox(height: AppSpacing.sm),
                            Text(
                              '${PinCode.maxAttempts - state.failedAttempts} tentative(s) restante(s)',
                              style: AppTextStyles.caption.copyWith(
                                color: scheme.error,
                              ),
                            ),
                          ],
                          SizedBox(height: compact ? 18 : 28),
                          AbsorbPointer(
                            absorbing: isLocked,
                            child: AnimatedOpacity(
                              opacity: isLocked ? 0.45 : 1,
                              duration: AppMotion.quick,
                              child: PinNumpad(
                                textColor: scheme.onSurface,
                                buttonColor: context.surfaceColor,
                                onDigit: notifier.addDigit,
                                onBack: notifier.removeDigit,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              if (mode == 'auth')
                TextButton(
                  onPressed: _isRecovering ? null : _confirmForgottenPin,
                  child: Text(
                    _isRecovering ? 'Réinitialisation…' : 'Code oublié ?',
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  0,
                  AppSpacing.lg,
                  AppSpacing.md,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.shield_outlined,
                      size: AppSpacing.iconSM,
                      color: context.textSecondaryColor,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Flexible(
                      child: Text(
                        'Le PIN protège l’accès local à cet appareil.',
                        style: AppTextStyles.bodySmall.copyWith(
                          color: context.textSecondaryColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// The way out of a forgotten PIN. Clears the code and signs the session
  /// out; the atelier's local data is untouched, which is what the copy
  /// promises, so this is recoverable rather than destructive.
  Future<void> _confirmForgottenPin() async {
    final confirmed = await AppDialogs.showConfirmation(
      title: 'Réinitialiser le code PIN ?',
      message:
          'Vous devrez vous reconnecter à votre compte pour définir un nouveau code. '
          'Les données de votre atelier restent sur cet appareil.',
      confirmLabel: 'Réinitialiser',
    );
    if (confirmed != true || !mounted) return;

    setState(() => _isRecovering = true);
    try {
      await ref.read(securityProvider.notifier).resetForgottenPin();
      await ref.read(authActionControllerProvider.notifier).logout();
      AppNavigator.offAll(AppRoutes.auth);
    } catch (error, stackTrace) {
      AppLogger.e('PIN reset failed', error, stackTrace);
      if (mounted) setState(() => _isRecovering = false);
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Impossible de réinitialiser le code. Réessayez.');
    }
  }

  String _subtitleFor(
    String mode,
    bool isConfirming,
    bool isLocked,
    DateTime? lockedUntil,
  ) {
    if (isLocked) {
      final remaining = lockedUntil!.difference(DateTime.now());
      final minutes = remaining.inMinutes;
      final seconds = remaining.inSeconds % 60;
      final delay = minutes > 0
          ? '$minutes min ${seconds.toString().padLeft(2, '0')} s'
          : '$seconds s';
      return 'Trop de tentatives. Réessayez dans $delay.';
    }
    if (isConfirming) {
      return 'Saisissez une seconde fois les quatre chiffres pour confirmer.';
    }
    switch (mode) {
      case 'create':
        return 'Choisissez quatre chiffres faciles à retenir, difficiles à deviner.';
      case 'change':
        return 'Vérifiez votre identité avant de définir un nouveau code.';
      case 'disable':
        return 'Confirmez votre code avant de retirer la protection locale.';
      default:
        return 'Saisissez vos quatre chiffres pour reprendre votre activité.';
    }
  }
}
