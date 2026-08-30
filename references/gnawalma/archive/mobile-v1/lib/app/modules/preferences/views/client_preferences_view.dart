import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/navigation/custom_app_bar.dart';
import '../../../shared/widgets/states/error_state.dart';
import '../controllers/preferences_provider.dart';
import '../widgets/preference_widgets.dart';

/// The client's "Apparence et accessibilité" row used to open the same
/// [PreferencesView] as the atelier's "Préférences" tile — business capacity,
/// fabric categories, stock/payment reminders, none of which mean anything to
/// a client browsing ateliers. This screen is the client-appropriate subset
/// of the same underlying (local, on-device) preferences state: appearance
/// only for now, since currency and the atelier notification toggles have no
/// client-facing meaning anywhere in the app today.
class ClientPreferencesView extends ConsumerWidget {
  const ClientPreferencesView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferences = ref.watch(preferencesProvider);
    final notifier = ref.read(preferencesProvider.notifier);

    return Scaffold(
      backgroundColor: context.backgroundColor,
      appBar: const CustomAppBar(title: 'Apparence et accessibilité'),
      body: preferences.when(
        loading: () => const SizedBox.shrink(),
        error: (error, _) => ErrorState(
          message: 'Impossible de charger les préférences.',
          onRetry: () => ref.invalidate(preferencesProvider),
        ),
        data: (state) => ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(
            AppSpacing.gutter,
            AppSpacing.md,
            AppSpacing.gutter,
            AppSpacing.xl + MediaQuery.paddingOf(context).bottom,
          ),
          children: [
            PreferenceGroup(
              title: 'Interface',
              subtitle: 'Affichage',
              children: [
                ThemeChooser(
                  value: state.selectedTheme,
                  onChanged: notifier.changeTheme,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
