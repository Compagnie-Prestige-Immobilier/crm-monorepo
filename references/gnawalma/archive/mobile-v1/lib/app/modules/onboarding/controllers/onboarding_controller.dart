import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../data/services/storage_service.dart';
import '../../../routes/app_routes.dart';
import '../../../core/navigation/app_navigator.dart';
import '../../../data/services/notification_service.dart';

part 'onboarding_controller.g.dart';

class OnboardingPageModel {
  final String title;
  final String description;
  final String imageAsset;

  OnboardingPageModel({
    required this.title,
    required this.description,
    required this.imageAsset,
  });
}

@riverpod
class OnboardingController extends _$OnboardingController {
  @override
  int build() => 0;

  void onPageChanged(int index) {
    state = index;
  }

  Future<void> completeOnboarding() async {
    final storageService = ref.read(storageProvider);
    await storageService.setOnboardingComplete();

    // Send Welcome Notification
    try {
      final notifService = GetIt.I<NotificationService>();
      await notifService.showWelcomeNotification();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error sending welcome notification: $e');
      }
    }

    // Navigate to space selector
    AppNavigator.offAll(AppRoutes.spaceSelector);
  }

  List<OnboardingPageModel> get pages => [
    OnboardingPageModel(
      title: 'Chaque mesure au bon endroit',
      description:
          'Enregistrez les mensurations et retrouvez leur historique sans dépendre de carnets dispersés.',
      imageAsset: 'assets/icons/illustrations/tutorial_1.png',
    ),
    OnboardingPageModel(
      title: 'Votre atelier sous contrôle',
      description:
          'Suivez les commandes, les avances et les échéances depuis un tableau de travail clair.',
      imageAsset: 'assets/icons/illustrations/tutorial_2.png',
    ),
    OnboardingPageModel(
      title: 'Un suivi plus clair pour vos clients',
      description:
          'Gardez chaque étape visible, de la prise de mesure à la livraison, pour éviter les oublis et les malentendus.',
      imageAsset: 'assets/icons/illustrations/tutorial_3.png',
    ),
  ];
}
