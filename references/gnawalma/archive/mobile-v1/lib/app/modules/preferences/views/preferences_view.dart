import '../../../shared/widgets/states/skeleton.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/services/security_service.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/navigation/custom_app_bar.dart';
import '../../../shared/widgets/states/error_state.dart';
import '../controllers/preferences_provider.dart';
import '../widgets/preference_widgets.dart';

class PreferencesView extends ConsumerWidget {
  const PreferencesView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferences = ref.watch(preferencesProvider);
    final security = ref.watch(securityProvider);
    final notifier = ref.read(preferencesProvider.notifier);

    return Scaffold(
      backgroundColor: context.backgroundColor,
      appBar: const CustomAppBar(title: 'Préférences'),
      body: preferences.when(
        loading: () => const _PreferencesSkeleton(),
        error: (error, _) => ErrorState(
          message: 'Impossible de charger les préférences.',
          onRetry: () => ref.invalidate(preferencesProvider),
        ),
        data: (state) {
          final hasPin = security.value?.hasPin ?? false;
          final activeAlerts = !state.notificationsEnabled
              ? 0
              : [
                  state.overdueReminders,
                  state.paymentReminders,
                ].where((enabled) => enabled).length;

          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(
              AppSpacing.gutter,
              AppSpacing.md,
              AppSpacing.gutter,
              AppSpacing.xl + MediaQuery.paddingOf(context).bottom,
            ),
            children: [
              PreferenceGroup(
                title: 'Atelier',
                subtitle: 'Identité publique et capacité de production',
                children: [
                  PreferenceRow(
                    icon: Icons.storefront_outlined,
                    title: 'Profil de l’atelier',
                    subtitle: 'Nom, adresse, contacts et identité publique',
                    value: 'Modifier',
                    onTap: () => AppNavigator.toBusinessProfile(context),
                  ),
                  PreferenceRow(
                    icon: Icons.speed_rounded,
                    title: 'Capacité hebdomadaire',
                    subtitle: 'Aide à signaler une charge réaliste',
                    value: '${state.maxProjectsPerWeek} / semaine',
                    onTap: () => _showCapacitySheet(
                      context,
                      state.maxProjectsPerWeek,
                      notifier,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sectionSpacing),
              PreferenceGroup(
                title: 'Interface',
                subtitle: 'Affichage, langue et monnaie',
                children: [
                  // Three short options: an inline segmented control shows the
                  // current choice and every alternative without a round trip
                  // through a sheet.
                  ThemeChooser(
                    value: state.selectedTheme,
                    onChanged: notifier.changeTheme,
                  ),
                  // Not a picker. The interface has no localisation layer yet —
                  // every string is French — so offering English and Wolof
                  // stored a choice the app then ignored. Stated as fact until
                  // translations exist.
                  const PreferenceRow(
                    icon: Icons.translate_rounded,
                    title: 'Langue de travail',
                    subtitle: 'L’interface est disponible en français',
                    value: 'Français',
                  ),
                  PreferenceRow(
                    icon: Icons.payments_outlined,
                    title: 'Devise',
                    subtitle: 'Utilisée pour les commandes et les reçus',
                    value: state.selectedCurrency,
                    onTap: () => _showSelection(
                      context,
                      title: 'Devise',
                      subtitle:
                          'Change l’affichage des montants. Les valeurs enregistrées ne sont pas converties.',
                      current: state.selectedCurrency,
                      options: const ['FCFA', 'EUR', 'USD'],
                      onSelected: notifier.changeCurrency,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sectionSpacing),
              PreferenceGroup(
                title: 'Confidentialité',
                subtitle: hasPin
                    ? 'Code PIN actif sur cet appareil'
                    : 'L’accès local n’est pas protégé',
                children: [
                  PreferenceSwitchTile(
                    icon: Icons.lock_person_outlined,
                    title: 'Verrouillage par code PIN',
                    subtitle:
                        'Protège l’accès local. Il ne remplace pas votre connexion au compte.',
                    value: hasPin,
                    enabled: !security.isLoading,
                    onChanged: notifier.toggleSecurity,
                  ),
                  if (hasPin)
                    PreferenceRow(
                      icon: Icons.password_rounded,
                      title: 'Modifier le code PIN',
                      subtitle: 'Une vérification du code actuel sera demandée',
                      value: '••••',
                      onTap: notifier.changePin,
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.sectionSpacing),
              PreferenceGroup(
                title: 'Notifications',
                subtitle: state.notificationsEnabled
                    ? '$activeAlerts rappel${activeAlerts > 1 ? 's' : ''} actif${activeAlerts > 1 ? 's' : ''} sur 3'
                    : 'Tous les rappels sont en pause',
                children: [
                  PreferenceSwitchTile(
                    icon: Icons.notifications_none_rounded,
                    title: 'Autoriser les alertes',
                    subtitle: 'Interrupteur principal pour tous les rappels',
                    value: state.notificationsEnabled,
                    onChanged: notifier.toggleNotifications,
                  ),
                  if (!state.notificationsEnabled)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.listRowInset,
                        2,
                        AppSpacing.listRowInset,
                        AppSpacing.xs,
                      ),
                      child: const AppStatusBanner(
                        compact: true,
                        icon: Icons.notifications_off_outlined,
                        tone: AppStatusTone.neutral,
                        title: 'Rappels en pause',
                        message:
                            'Activez les alertes pour reprendre les rappels ci-dessous.',
                      ),
                    ),
                  PreferenceSwitchTile(
                    icon: Icons.event_busy_outlined,
                    title: 'Retards de livraison',
                    subtitle: 'Avertir lorsqu’une échéance est dépassée',
                    value: state.overdueReminders,
                    enabled: state.notificationsEnabled,
                    onChanged: notifier.toggleOverdueReminders,
                  ),
                  PreferenceSwitchTile(
                    icon: Icons.account_balance_wallet_outlined,
                    title: 'Suivi des paiements',
                    subtitle: 'Rappeler les soldes encore dus',
                    value: state.paymentReminders,
                    enabled: state.notificationsEnabled,
                    onChanged: notifier.togglePaymentReminders,
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _showSelection(
    BuildContext context, {
    required String title,
    required String subtitle,
    required String current,
    required List<String> options,
    required ValueChanged<String> onSelected,
  }) async {
    await showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          0,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppSectionHeader(title: title, subtitle: subtitle),
            const SizedBox(height: AppSpacing.md),
            RadioGroup<String>(
              groupValue: current,
              onChanged: (value) {
                if (value == null) return;
                onSelected(value);
                Navigator.pop(sheetContext);
              },
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final option in options)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                      child: Builder(
                        builder: (context) {
                          final isCurrent = option == current;
                          final scheme = Theme.of(context).colorScheme;
                          return RadioListTile<String>.adaptive(
                            value: option,
                            selected: isCurrent,
                            title: Text(
                              option,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.label.copyWith(
                                color: context.textPrimaryColor,
                              ),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.sm,
                            ),
                            // The selected option is outlined in ink instead of
                            // relying on the radio dot alone.
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(
                                AppSpacing.radiusMD,
                              ),
                              side: BorderSide(
                                color: isCurrent
                                    ? scheme.primary
                                    : context.borderColor,
                                width: isCurrent ? 1.6 : 1,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showCapacitySheet(
    BuildContext context,
    int current,
    Preferences notifier,
  ) async {
    final controller = TextEditingController(text: '$current');
    try {
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
        builder: (sheetContext) => StatefulBuilder(
          builder: (context, setSheetState) {
            final value = int.tryParse(controller.text.trim());
            final valid = value != null && value > 0 && value <= 200;
            return Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const AppSectionHeader(
                    title: 'Capacité hebdomadaire',
                    subtitle:
                        'Indiquez un volume réaliste pour éviter les promesses intenables.',
                    icon: Icons.speed_rounded,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextField(
                    controller: controller,
                    autofocus: true,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setSheetState(() {}),
                    decoration: InputDecoration(
                      labelText: 'Nombre de projets par semaine',
                      suffixText: 'projets',
                      errorText: controller.text.isNotEmpty && !valid
                          ? 'Saisissez une valeur entre 1 et 200.'
                          : null,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  // Common volumes, so the usual answer is one tap.
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      for (final preset in const [5, 10, 15, 20, 30])
                        ChoiceChip(
                          label: Text('$preset'),
                          selected: value == preset,
                          onSelected: (_) =>
                              setSheetState(() => controller.text = '$preset'),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  FilledButton(
                    onPressed: !valid
                        ? null
                        : () {
                            notifier.updateMaxProjects(value);
                            Navigator.pop(sheetContext);
                          },
                    child: const Text('Enregistrer la capacité'),
                  ),
                ],
              ),
            );
          },
        ),
      );
    } finally {
      controller.dispose();
    }
  }
}

class _PreferencesSkeleton extends StatelessWidget {
  const _PreferencesSkeleton();

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          AppSpacing.md,
          AppSpacing.gutter,
          AppSpacing.xl + MediaQuery.paddingOf(context).bottom,
        ),
        children: [
          for (var group = 0; group < 3; group++) ...[
            if (group > 0) const SizedBox(height: AppSpacing.sectionSpacing),
            const SkeletonBox(width: 120, height: 16),
            const SizedBox(height: AppSpacing.md),
            for (var row = 0; row < 3; row++) ...[
              if (row > 0) const SizedBox(height: AppSpacing.sm),
              const SkeletonBox(height: 56, radius: AppSpacing.radiusMD),
            ],
          ],
        ],
      ),
    );
  }
}
