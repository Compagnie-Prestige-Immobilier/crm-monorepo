import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app/data/services/active_space_provider.dart';
import 'app/data/services/app_space.dart';
import 'app/init/app_bootstrapper.dart';
import 'app/core/network/server_warmup.dart';
import 'app/routes/app_router.dart';
import 'app/shared/theme/app_spacing.dart';
import 'app/shared/theme/app_theme.dart';
import 'app/modules/preferences/controllers/preferences_provider.dart';
import 'app/shared/widgets/feedback/feedback_overlay_listener.dart';
import 'app/shared/constants/app_constants.dart';

/// Main entry point of the Gnawalma application
void main() async {
  // Premier geste du processus, avant toute initialisation locale : réveiller
  // l'instance Render, qui dort après quelques minutes sans trafic. Le ping
  // n'est pas attendu, il court pendant que la base locale s'ouvre et que les
  // premiers écrans se peignent — de sorte que la première vraie requête ne
  // paie plus le démarrage à froid du serveur.
  ServerWarmup.kick();

  // Bootstrap the application initialization
  await AppBootstrapper.init();

  // Materialise the semantics tree in debug builds so accessibility auditing
  // and UI automation can address widgets by label.
  const disableDebugSemantics = bool.fromEnvironment(
    'GNMA_DISABLE_DEBUG_SEMANTICS',
  );
  if (kDebugMode && !disableDebugSemantics) {
    SemanticsBinding.instance.ensureSemantics();
  }

  // Initialize Riverpod container for static bridge access
  final container = ProviderContainer();
  AppBootstrapper.container = container;

  // Run the app
  runApp(
    UncontrolledProviderScope(container: container, child: const GnawalmaApp()),
  );
}

/// Root application widget
class GnawalmaApp extends ConsumerWidget {
  const GnawalmaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferences = ref.watch(preferencesProvider);

    return preferences.when(
      data: (prefs) {
        ThemeMode themeMode;
        switch (prefs.selectedTheme) {
          case AppConstants.themeLight:
            themeMode = ThemeMode.light;
            break;
          case AppConstants.themeDark:
            themeMode = ThemeMode.dark;
            break;
          case AppConstants.themeSystem:
          default:
            themeMode = ThemeMode.system;
        }

        // The accent is applied here, above the router, so every route —
        // shell branch, pushed detail, modal form — is painted in the space
        // the user is actually in. Applying it inside the shells left every
        // pushed route on the fallback palette.
        //
        // Before a space is chosen (onboarding, space selector) there is no
        // space to honour, so the neutral fallback stands in.
        final space = ref.watch(activeSpaceProvider) ?? AppSpace.atelier;

        return MaterialApp.router(
          title: "Gnawalma",
          debugShowCheckedModeBanner: false,

          // Apply custom themes
          theme: AppTheme.forSpace(space, Brightness.light),
          darkTheme: AppTheme.forSpace(space, Brightness.dark),
          themeMode: themeMode,

          // Routing via GoRouter
          routerConfig: AppRouter.router,

          // Global Overlay Listener
          builder: (context, child) {
            return Overlay(
              initialEntries: [
                OverlayEntry(
                  builder: (context) => FeedbackOverlayListener(child: child!),
                ),
              ],
            );
          },
        );
      },
      // These two render before preferences resolve, so they must carry the
      // theme themselves. Without it they fall back to stock Material — a
      // purple spinner on lavender — which is what the user sees on every cold
      // start until the stored preferences load.
      loading: () =>
          _bootShell(const Center(child: CircularProgressIndicator.adaptive())),
      error: (err, stack) => _bootShell(
        Builder(
          builder: (context) => Padding(
            padding: const EdgeInsets.all(AppSpacing.gutter),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.error_outline_rounded,
                    size: 40,
                    color: Theme.of(context).colorScheme.error,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    'Gnawalma n’a pas pu démarrer.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Fermez puis rouvrez l’application. Si le problème persiste, contactez le support.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Themed shell for the frames that render before preferences are available.
  Widget _bootShell(Widget child) => MaterialApp(
    title: 'Gnawalma',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.lightTheme,
    darkTheme: AppTheme.darkTheme,
    themeMode: ThemeMode.system,
    home: Scaffold(body: child),
  );
}
