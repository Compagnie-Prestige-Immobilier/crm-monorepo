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

  Future<void> complete() async {
    await ref.read(sharedPreferencesProvider).setBool(_completedKey, true);
    state = true;
  }
}
