import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/app_providers.dart';

final NotifierProvider<OnboardingController, bool>
onboardingControllerProvider = NotifierProvider<OnboardingController, bool>(
  OnboardingController.new,
);

class OnboardingController extends Notifier<bool> {
  static const String _completedKey = 'cpi.onboarding.completed';

  @override
  bool build() =>
      ref.read(sharedPreferencesProvider).getBool(_completedKey) ?? false;

  /// Le sas s'ouvre même si le réglage ne s'écrit pas : un stockage en panne ne
  /// doit pas enfermer le téléphone sur l'écran de bienvenue. L'échec remonte
  /// quand même, pour que l'écran le dise.
  Future<void> complete() async {
    try {
      await ref.read(sharedPreferencesProvider).setBool(_completedKey, true);
    } finally {
      state = true;
    }
  }
}
