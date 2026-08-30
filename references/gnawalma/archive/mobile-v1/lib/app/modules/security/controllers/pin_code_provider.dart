import 'dart:async';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../data/services/security_service.dart';
import '../../../shared/services/feedback_service.dart';
import '../../../core/navigation/app_navigator.dart';
import '../../../routes/app_routes.dart';
import 'pin_code_state.dart';

part 'pin_code_provider.g.dart';

@riverpod
class PinCode extends _$PinCode {
  /// Failed attempts tolerated before the pad locks for five minutes.
  static const int maxAttempts = 5;

  @override
  PinCodeState build({String mode = 'auth'}) {
    String title;
    switch (mode) {
      case 'create':
        title = 'Créer un code PIN';
        break;
      case 'auth':
        title = 'Déverrouiller Gnawalma';
        break;
      case 'disable':
        title = 'Confirmer pour désactiver';
        break;
      case 'change':
        title = 'Entrez votre code actuel';
        break;
      default:
        title = 'Entrez votre code PIN';
    }
    return PinCodeState(mode: mode, title: title);
  }

  Future<void> addDigit(int digit) async {
    // Check if locked out
    if (state.lockedUntil != null &&
        DateTime.now().isBefore(state.lockedUntil!)) {
      final remaining = state.lockedUntil!.difference(DateTime.now()).inSeconds;
      ref
          .read(feedbackServiceProvider.notifier)
          .showError(
            'Trop de tentatives. Réessayez dans ${(remaining / 60).ceil()} minutes.',
          );
      return;
    }

    if (state.pin.length < 4) {
      final newPin = state.pin + digit.toString();
      state = state.copyWith(pin: newPin);
      if (newPin.length == 4) {
        final success = await _submitPin();
        if (success) {
          if (state.mode == 'auth') {
            // Auth mode can be reached via offAll(lock). Always land on a known route.
            AppNavigator.offAll(AppRoutes.shell);
          } else {
            AppNavigator.back(true);
          }
        }
      }
    }
  }

  void removeDigit() {
    if (state.pin.isNotEmpty) {
      state = state.copyWith(pin: state.pin.substring(0, state.pin.length - 1));
    }
  }

  Future<bool> _submitPin() async {
    await Future.delayed(const Duration(milliseconds: 300));

    final security = ref.read(securityProvider.notifier);

    switch (state.mode) {
      case 'auth':
        final isValid = await security.verifyPin(state.pin);
        if (isValid) {
          // Reset failed attempts on success
          security.unlockApp();
          state = state.copyWith(failedAttempts: 0, lockedUntil: null);
          return true;
        } else {
          _handleFailedAttempt();
          _shakeError();
          return false;
        }

      case 'create':
        if (!state.isConfirming) {
          // First entry done, switch to confirm
          state = state.copyWith(
            firstPin: state.pin,
            pin: '',
            isConfirming: true,
            title: 'Confirmez le code PIN',
          );
          return false;
        } else {
          // Confirmation done
          if (state.pin == state.firstPin) {
            await security.setPin(state.pin);
            ref
                .read(feedbackServiceProvider.notifier)
                .showSuccess('Sécurité', 'Code PIN activé');
            return true;
          } else {
            _shakeError();
            state = state.copyWith(
              pin: '',
              title: 'Les codes ne correspondent pas. Réessayez.',
            );
            return false;
          }
        }

      case 'disable':
        final isValid = await security.verifyPin(state.pin);
        if (isValid) {
          await security.removePin();
          security.unlockApp();
          ref
              .read(feedbackServiceProvider.notifier)
              .showInfo('Code PIN désactivé');
          return true;
        } else {
          _shakeError();
          return false;
        }

      case 'change':
        if (!state.isOldVerified) {
          // Verify old PIN
          final isValid = await security.verifyPin(state.pin);
          if (isValid) {
            state = state.copyWith(
              isOldVerified: true,
              pin: '',
              title: 'Entrez le nouveau code',
            );
            return false;
          } else {
            _shakeError();
            return false;
          }
        } else {
          // New PIN creation flow
          if (!state.isConfirming) {
            // First entry of new PIN
            state = state.copyWith(
              firstPin: state.pin,
              pin: '',
              isConfirming: true,
              title: 'Confirmez le nouveau code',
            );
            return false;
          } else {
            // Confirmation of new PIN
            if (state.pin == state.firstPin) {
              await security.setPin(state.pin);
              ref
                  .read(feedbackServiceProvider.notifier)
                  .showSuccess('Sécurité', 'Code PIN modifié avec succès');
              return true;
            } else {
              _shakeError();
              state = state.copyWith(
                pin: '',
                isConfirming: false,
                title:
                    'Les codes ne correspondent pas. Réessayez le nouveau code.',
              );
              return false;
            }
          }
        }

      default:
        return false;
    }
  }

  void _shakeError() {
    state = state.copyWith(pin: '');
    ref.read(feedbackServiceProvider.notifier).showError('Code PIN incorrect');
  }

  void _handleFailedAttempt() {
    final newFailedAttempts = state.failedAttempts + 1;

    if (newFailedAttempts >= PinCode.maxAttempts) {
      // Lock for 5 minutes after 5 failed attempts
      state = state.copyWith(
        failedAttempts: newFailedAttempts,
        lockedUntil: DateTime.now().add(const Duration(minutes: 5)),
      );
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Trop de tentatives. Réessayez dans 5 minutes.');
    } else {
      state = state.copyWith(failedAttempts: newFailedAttempts);
    }
  }
}
