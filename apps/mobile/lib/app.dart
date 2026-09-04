import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';

import 'core/providers/app_providers.dart';
import 'features/notifications/notifications_controller.dart';
import 'features/notifications/push_deep_link_listener.dart';
import 'features/notifications/rep_callback_due_listener.dart';
import 'features/telephonie/appels_a_consigner.dart';
import 'core/router/app_router.dart';
import 'core/settings/display_settings.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/cpi_tokens.dart';
import 'core/theme/forui_theme.dart';
import 'features/auth/auth_state.dart';
import 'core/updates/app_update_controller.dart';
import 'core/onboarding/onboarding_controller.dart';
import 'features/updates/presentation/app_update_screen.dart';
import 'features/onboarding/presentation/onboarding_screen.dart';

class CpiGoApp extends ConsumerWidget {
  const CpiGoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final DisplaySettings settings = ref.watch(displaySettingsProvider);
    final ThemeMode themeMode = settings.themeMode;
    // Les transitions de page vivent dans le `ThemeData` : leur durée est lue
    // à la construction de la route, pas à chaque image. C'est ici, au-dessus
    // du `MaterialApp`, qu'il faut choisir la variante figée.
    final bool still =
        settings.reduceMotion ||
        (MediaQuery.maybeDisableAnimationsOf(context) ?? false);
    final ThemeData clair = still ? AppTheme.lightStill : AppTheme.light;
    final ThemeData sombre = still ? AppTheme.darkStill : AppTheme.dark;
    if (!ref.watch(onboardingControllerProvider)) {
      return MaterialApp(
        title: 'CPI GO',
        debugShowCheckedModeBanner: false,
        theme: clair,
        darkTheme: sombre,
        themeMode: themeMode,
        locale: const Locale('fr', 'SN'),
        supportedLocales: _supportedLocales,
        localizationsDelegates: _localizationsDelegates,
        home: const OnboardingScreen(),
      );
    }
    final AuthState auth = ref.watch(authControllerProvider);

    if (!auth.isResolved) {
      return MaterialApp(
        title: 'CPI GO',
        debugShowCheckedModeBanner: false,
        theme: clair,
        darkTheme: sombre,
        themeMode: themeMode,
        locale: const Locale('fr', 'SN'),
        supportedLocales: _supportedLocales,
        localizationsDelegates: _localizationsDelegates,
        home: const _BrandSplash(),
      );
    }

    if (auth.isAuthenticated) {
      ref.watch(syncCoordinatorProvider.notifier);
      ref.watch(notificationsCoordinatorProvider.notifier);
    }

    // La porte de mise à jour vient APRÈS l'authentification et après le montage
    // de la synchronisation : sinon l'écran bloquant prenait l'écran avant que
    // l'outbox n'ait la moindre chance de partir, et les saisies du jour
    // restaient sur un téléphone qu'on venait de condamner.
    final AppUpdateState update = ref.watch(appUpdateControllerProvider);
    if (update.isBlocking || update.requiresPrompt) {
      return MaterialApp(
        title: 'CPI GO',
        debugShowCheckedModeBanner: false,
        theme: clair,
        darkTheme: sombre,
        themeMode: themeMode,
        locale: const Locale('fr', 'SN'),
        supportedLocales: _supportedLocales,
        localizationsDelegates: _localizationsDelegates,
        home: AppUpdateScreen(state: update),
      );
    }

    return MaterialApp.router(
      title: 'CPI GO',
      debugShowCheckedModeBanner: false,
      theme: clair,
      darkTheme: sombre,
      themeMode: themeMode,
      locale: const Locale('fr', 'SN'),
      supportedLocales: _supportedLocales,
      localizationsDelegates: _localizationsDelegates,
      routerConfig: ref.watch(routerProvider),
      builder: (BuildContext context, Widget? child) {
        final DisplaySettings display = settings;
        final MediaQueryData media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(
            textScaler: TextScaler.linear(
              resolveTextScaleFactor(
                system: media.textScaler,
                choice: display.textScale,
              ),
            ),
            disableAnimations: media.disableAnimations || display.reduceMotion,
          ),
          // `FTheme`/`FToaster` racine : tout contexte, y compris celui d'un
          // `State` d'écran, trouve le thème ForUI et un toaster. `ProjectScope`
          // re-pose le thème par projet en dessous.
          child: FTheme(
            data: cpiForuiTheme(
              Theme.of(context),
              reduceMotion: media.disableAnimations || display.reduceMotion,
            ),
            child: FToaster(
              child: RepCallbackDueListener(
                child: AppelsDetectesListener(
                  child: PushDeepLinkListener(
                    child: child ?? const SizedBox.shrink(),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

const List<Locale> _supportedLocales = <Locale>[
  Locale('fr', 'SN'),
  Locale('fr'),
];

const List<LocalizationsDelegate<dynamic>> _localizationsDelegates =
    <LocalizationsDelegate<dynamic>>[
      // Sans ce délégué, feuilles, fonds et roues ForUI s'annoncent en anglais
      // (« Sheet », « Barrier ») dans une application française (WCAG 3.1.2).
      FLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ];

class _BrandSplash extends StatelessWidget {
  const _BrandSplash();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final ColorScheme scheme = theme.colorScheme;
    // Le d\u00e9marrage est le premier \u00e9cran vu : il montre la m\u00eame surface neutre
    // que l'application, en clair comme en sombre. La marque n'y tient que le
    // logo et le fil de progression.
    final bool dark = theme.brightness == Brightness.dark;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      // Le fond n'est plus l'aplat de marque : les icônes système suivent
      // maintenant la surface neutre, sans quoi elles disparaissent en clair.
      value: SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: dark ? Brightness.light : Brightness.dark,
        statusBarBrightness: dark ? Brightness.dark : Brightness.light,
        systemNavigationBarColor: scheme.surface,
        systemNavigationBarIconBrightness: dark
            ? Brightness.light
            : Brightness.dark,
      ),
      child: ColoredBox(
        color: scheme.surface,
        child: Stack(
          children: <Widget>[
            Center(
              // Le logo couleur est sur fond blanc opaque : sur la surface
              // sombre il ferait une plaque. Le fichier d'en-t\u00eate est le m\u00eame
              // dessin d\u00e9tour\u00e9, en blanc.
              child: Image(
                image: AssetImage(
                  dark
                      ? 'assets/brand/cpi-header.png'
                      : 'assets/brand/cpi-logo.png',
                ),
                width: 120,
                fit: BoxFit.contain,
                semanticLabel: 'CPI',
              ),
            ),
            Positioned(
              left: CpiSpacing.xl,
              right: CpiSpacing.xl,
              bottom: CpiSpacing.xxl,
              child: Column(
                children: <Widget>[
                  Text(
                    'Chargement\u2026',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                    semanticsLabel: 'Chargement en cours',
                  ),
                  const SizedBox(height: CpiSpacing.xs),
                  FTheme(
                    data: cpiForuiTheme(theme),
                    child: FProgress(
                      semanticsLabel: 'Chargement en cours',
                      style: FProgressStyleDelta.delta(
                        constraints: const BoxConstraints.tightFor(height: 3),
                        trackDecoration: DecorationDelta.value(
                          BoxDecoration(
                            color: scheme.surfaceContainerHigh,
                            borderRadius: CpiRadius.brFull,
                          ),
                        ),
                        fillDecoration: DecorationDelta.value(
                          BoxDecoration(
                            color: scheme.primary,
                            borderRadius: CpiRadius.brFull,
                          ),
                        ),
                      ),
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
}
