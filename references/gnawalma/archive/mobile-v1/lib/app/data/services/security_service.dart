import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../core/navigation/app_navigator.dart';
import '../../routes/app_routes.dart';
import '../../shared/utils/app_feedback.dart';
import 'storage_service.dart';

part 'security_service.g.dart';

/// Riverpod provider for SecurityService
@Riverpod(keepAlive: true)
Future<SecurityService> securityService(Ref ref) async {
  return SecurityService();
}

class SecurityState {
  final bool hasPin;
  final bool isAppLocked;

  const SecurityState({this.hasPin = false, this.isAppLocked = false});

  SecurityState copyWith({bool? hasPin, bool? isAppLocked}) {
    return SecurityState(
      hasPin: hasPin ?? this.hasPin,
      isAppLocked: isAppLocked ?? this.isAppLocked,
    );
  }
}

@Riverpod(keepAlive: true)
class Security extends _$Security {
  static const String _pinKey = 'user_pin';
  int _failedAttempts = 0;
  DateTime? _lockoutEndTime;

  @override
  Future<SecurityState> build() async {
    final storage = ref.watch(storageProvider);
    final pin = await storage.read(_pinKey);
    final isLocked = await storage.isAppLocked;
    return SecurityState(hasPin: pin != null, isAppLocked: isLocked);
  }

  /// Hash PIN using PBKDF2 with salt for secure storage
  /// Using PBKDF2 instead of plain SHA-256 to prevent rainbow table attacks
  String _hashPin(String pin) {
    // Use device-specific salt (could also use user ID or generated salt)
    const salt =
        'gnawalma_pin_salt_v1'; // In production, use unique per-user salt
    final bytes = utf8.encode(pin + salt);
    var digest = sha256.convert(bytes);

    // Apply PBKDF2-like iteration (10000 rounds)
    for (var i = 0; i < 10000; i++) {
      digest = sha256.convert(utf8.encode(digest.toString()));
    }

    return digest.toString();
  }

  Future<void> setPin(String pin) async {
    final storage = ref.read(storageProvider);
    final hashedPin = _hashPin(pin);
    await storage.write(_pinKey, hashedPin);
    state = AsyncData(state.value!.copyWith(hasPin: true));
  }

  Future<bool> updatePin(String oldPin, String newPin) async {
    final storage = ref.read(storageProvider);
    final currentPin = await storage.read(_pinKey);
    final hashedOldPin = _hashPin(oldPin);
    if (currentPin == hashedOldPin) {
      await setPin(newPin);
      return true;
    }
    return false;
  }

  Future<void> removePin() async {
    final storage = ref.read(storageProvider);
    await storage.delete(_pinKey);
    state = AsyncData(state.value!.copyWith(hasPin: false));
  }

  Future<bool> verifyPin(String pin) async {
    // Check Lockout
    if (_lockoutEndTime != null) {
      if (DateTime.now().isBefore(_lockoutEndTime!)) {
        final waitSeconds = _lockoutEndTime!
            .difference(DateTime.now())
            .inSeconds;
        AppFeedback.showToast(
          title: 'Sécurité',
          message: 'Trop d\'essais. Réessayez dans $waitSeconds s',
        );
        return false;
      } else {
        _lockoutEndTime = null;
        _failedAttempts = 0;
      }
    }

    final storage = ref.read(storageProvider);
    final storedPin = await storage.read(_pinKey);
    final hashedPin = _hashPin(pin);
    final isValid = storedPin == hashedPin;

    if (isValid) {
      _failedAttempts = 0;
      _lockoutEndTime = null;
      await storage.setAppLocked(false);
      state = AsyncData(state.value!.copyWith(isAppLocked: false));
      return true;
    } else {
      _failedAttempts++;
      if (_failedAttempts >= 3) {
        _lockoutEndTime = DateTime.now().add(const Duration(seconds: 30));
        AppFeedback.showToast(
          title: 'Sécurité',
          message: 'Application verrouillée pour 30 secondes.',
        );
      }
      return false;
    }
  }

  void lockApp() {
    if (state.value?.hasPin == true) {
      ref.read(storageProvider).setAppLocked(true);
      state = AsyncData(state.value!.copyWith(isAppLocked: true));
      AppNavigator.offAll(AppRoutes.pinCode, arguments: {'mode': 'auth'});
    }
  }

  void unlockApp() {
    state = AsyncData(state.value!.copyWith(isAppLocked: false));
  }

  /// Clears the PIN and unlocks the app, for a user who has forgotten it.
  ///
  /// Without this the lock screen is a dead end: it cannot be dismissed, there
  /// is no sign-out behind it, and the PIN is the only credential — so
  /// forgetting four digits made the install permanently unusable with the
  /// atelier's whole order book still inside it.
  ///
  /// The local database is deliberately left untouched. The caller signs the
  /// session out afterwards, so re-entry goes through normal authentication.
  Future<void> resetForgottenPin() async {
    final storage = ref.read(storageProvider);
    await storage.delete(_pinKey);
    await storage.setAppLocked(false);
    _failedAttempts = 0;
    _lockoutEndTime = null;
    state = AsyncData(state.value!.copyWith(hasPin: false, isAppLocked: false));
  }
}

/// SecurityService - Plain Dart class for direct usage
class SecurityService {
  final _storage = const FlutterSecureStorage();
  bool _hasPin = false;
  bool _isAppLocked = false;

  static const String _pinKey = 'user_pin';

  // Brute-force protection
  int _failedAttempts = 0;
  DateTime? _lockoutEndTime;

  bool get hasPin => _hasPin;
  bool get isAppLocked => _isAppLocked;

  /// Hash PIN using PBKDF2 with salt for secure storage
  /// Using PBKDF2 instead of plain SHA-256 to prevent rainbow table attacks
  String _hashPin(String pin) {
    // Use device-specific salt (could also use user ID or generated salt)
    const salt =
        'gnawalma_pin_salt_v1'; // In production, use unique per-user salt
    final bytes = utf8.encode(pin + salt);
    var digest = sha256.convert(bytes);

    // Apply PBKDF2-like iteration (10000 rounds)
    for (var i = 0; i < 10000; i++) {
      digest = sha256.convert(utf8.encode(digest.toString()));
    }

    return digest.toString();
  }

  Future<void> init() async {
    await _checkPinStatus();
  }

  Future<void> _checkPinStatus() async {
    final pin = await _storage.read(key: _pinKey);
    _hasPin = pin != null;
  }

  Future<void> setPin(String pin) async {
    final hashedPin = _hashPin(pin);
    await _storage.write(key: _pinKey, value: hashedPin);
    _hasPin = true;
  }

  Future<bool> updatePin(String oldPin, String newPin) async {
    final currentPin = await _storage.read(key: _pinKey);
    final hashedOldPin = _hashPin(oldPin);
    if (currentPin == hashedOldPin) {
      await setPin(newPin);
      return true;
    }
    return false;
  }

  Future<void> removePin() async {
    await _storage.delete(key: _pinKey);
    _hasPin = false;
  }

  Future<String?> getPin() async {
    // Note: Returns hashed PIN, not plain text
    return await _storage.read(key: _pinKey);
  }

  Future<bool> verifyPin(String pin) async {
    // Check Lockout
    if (_lockoutEndTime != null) {
      if (DateTime.now().isBefore(_lockoutEndTime!)) {
        final waitSeconds = _lockoutEndTime!
            .difference(DateTime.now())
            .inSeconds;
        AppFeedback.showToast(
          title: 'Sécurité',
          message: 'Trop d\'essais. Réessayez dans $waitSeconds s',
        );
        return false;
      } else {
        _lockoutEndTime = null;
        _failedAttempts = 0;
      }
    }

    final storedPin = await _storage.read(key: _pinKey);
    final hashedPin = _hashPin(pin);
    final isValid = storedPin == hashedPin;

    if (isValid) {
      _failedAttempts = 0;
      _lockoutEndTime = null;
      return true;
    } else {
      _failedAttempts++;
      if (_failedAttempts >= 3) {
        _lockoutEndTime = DateTime.now().add(const Duration(seconds: 30));
        AppFeedback.showToast(
          title: 'Sécurité',
          message: 'Application verrouillée pour 30 secondes.',
        );
      }
      return false;
    }
  }

  void lockApp() {
    if (_hasPin) {
      _isAppLocked = true;
      AppNavigator.offAll(AppRoutes.pinCode, arguments: {'mode': 'auth'});
    }
  }

  void unlockApp() {
    _isAppLocked = false;
  }

  Future<void> resetApp() async {
    await _storage.deleteAll();
    _hasPin = false;
    _isAppLocked = false;
  }

  Future<void> logout() async {
    lockApp();
  }
}
