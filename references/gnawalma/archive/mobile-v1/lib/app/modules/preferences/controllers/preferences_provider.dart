import 'package:freezed_annotation/freezed_annotation.dart';

import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:gnawalma/app/data/services/security_service.dart';
import 'package:gnawalma/app/data/services/backup_service.dart';
import '../../../data/services/storage_service.dart';
import '../../../shared/services/feedback_service.dart';
import '../../../shared/utils/app_logger.dart';
import 'package:gnawalma/app/routes/app_routes.dart';
import '../../../core/navigation/app_navigator.dart';
import '../../../shared/constants/app_constants.dart';

part 'preferences_provider.freezed.dart';
part 'preferences_provider.g.dart';

@freezed
abstract class PreferencesState with _$PreferencesState {
  const factory PreferencesState({
    @Default('FCFA') String selectedCurrency,
    @Default(AppConstants.themeSystem) String selectedTheme,
    @Default(10) int maxProjectsPerWeek,
    @Default(true) bool notificationsEnabled,
    @Default(true) bool overdueReminders,
    @Default(true) bool paymentReminders,
  }) = _PreferencesState;
}

@Riverpod(keepAlive: true)
class Preferences extends _$Preferences {
  @override
  Future<PreferencesState> build() async {
    final storage = ref.watch(storageProvider);

    final currency = await storage.read('currency') ?? 'FCFA';
    final theme = await storage.read('theme') ?? AppConstants.themeSystem;
    final maxProjectsStr = await storage.read('maxProjectsPerWeek');
    final maxProjects = int.tryParse(maxProjectsStr ?? '10') ?? 10;

    final notif = (await storage.read('notificationsEnabled')) != 'false';
    final overdue = (await storage.read('overdueReminders')) != 'false';
    final payment = (await storage.read('paymentReminders')) != 'false';

    return PreferencesState(
      selectedCurrency: currency,
      selectedTheme: theme,
      maxProjectsPerWeek: maxProjects,
      notificationsEnabled: notif,
      overdueReminders: overdue,
      paymentReminders: payment,
    );
  }

  Future<void> updateMaxProjects(int value) async {
    await _mutate(state.value!.copyWith(maxProjectsPerWeek: value));
  }

  Future<void> changeTheme(String value) async {
    await _mutate(state.value!.copyWith(selectedTheme: value));
  }

  Future<void> changeCurrency(String value) async {
    await _mutate(state.value!.copyWith(selectedCurrency: value));
  }

  Future<void> toggleNotifications(bool value) async {
    await _mutate(state.value!.copyWith(notificationsEnabled: value));
  }

  Future<void> toggleOverdueReminders(bool value) async {
    await _mutate(state.value!.copyWith(overdueReminders: value));
  }

  Future<void> togglePaymentReminders(bool value) async {
    await _mutate(state.value!.copyWith(paymentReminders: value));
  }

  Future<void> backupData() async {
    await ref.read(backupProvider).createBackup();
  }

  Future<void> restoreData() async {
    await ref.read(backupProvider).restoreBackup();
  }

  Future<void> toggleSecurity(bool value) async {
    if (value) {
      // Enable PIN -> Create Mode
      final success = await AppNavigator.to(
        AppRoutes.pinCode,
        arguments: {'mode': 'create'},
      );
      if (success == true) {
        ref.invalidate(securityProvider);
      }
    } else {
      // Disable PIN -> Disable Mode (Auth required)
      final success = await AppNavigator.to(
        AppRoutes.pinCode,
        arguments: {'mode': 'disable'},
      );
      if (success == true) {
        ref.invalidate(securityProvider);
      }
    }
  }

  Future<void> changePin() async {
    final hasPin = ref.read(securityProvider).value?.hasPin ?? false;
    if (!hasPin) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showWarning('Veuillez d\'abord activer la sécurité.');
      return;
    }

    await AppNavigator.to(AppRoutes.pinCode, arguments: {'mode': 'change'});
  }

  /// Applies an optimistic change and rolls it back if the write fails.
  ///
  /// Every setter used to paint the new value and then call [_save], which had
  /// no error path — so a failed write left the switch on and the value gone,
  /// and the user only discovered it on the next launch.
  Future<void> _mutate(PreferencesState next) async {
    final previous = state.value!;
    state = AsyncData(next);
    try {
      await _save();
    } catch (error, stackTrace) {
      state = AsyncData(previous);
      AppLogger.e('Preference write failed', error, stackTrace);
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Réglage non enregistré. Réessayez.');
    }
  }

  Future<void> _save() async {
    final s = state.value!;
    final storage = ref.read(storageProvider);

    await storage.write('currency', s.selectedCurrency);
    await storage.write('theme', s.selectedTheme);
    await storage.write('maxProjectsPerWeek', s.maxProjectsPerWeek.toString());
    await storage.write(
      'notificationsEnabled',
      s.notificationsEnabled.toString(),
    );
    await storage.write('overdueReminders', s.overdueReminders.toString());
    await storage.write('paymentReminders', s.paymentReminders.toString());
  }
}
