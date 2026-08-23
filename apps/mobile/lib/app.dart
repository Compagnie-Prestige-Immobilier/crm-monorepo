import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/providers/app_providers.dart';
import 'features/notifications/notifications_controller.dart';
import 'features/notifications/push_deep_link_listener.dart';
import 'core/router/app_router.dart';
import 'core/settings/display_settings.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/cpi_tokens.dart';
import 'features/auth/auth_state.dart';
import 'core/updates/app_update_controller.dart';
import 'core/onboarding/onboarding_controller.dart';
import 'features/updates/presentation/app_update_screen.dart';
import 'features/onboarding/presentation/onboarding_screen.dart';

class CpiGoApp extends ConsumerWidget {
  const CpiGoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppUpdateState update = ref.watch(appUpdateControllerProvider);
    if (update.status == AppUpdateStatus.checking) {
      return MaterialApp(
        title: 'CPI GO',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        themeMode: ThemeMode.light,
        locale: const Locale('fr', 'SN'),
        supportedLocales: _supportedLocales,
        localizationsDelegates: _localizationsDelegates,
        home: const _BrandSplash(),
      );
    }
    if (update.requiresPrompt) {
      return MaterialApp(
        title: 'CPI GO',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        themeMode: ThemeMode.light,
        locale: const Locale('fr', 'SN'),
        supportedLocales: _supportedLocales,
        localizationsDelegates: _localizationsDelegates,
        home: AppUpdateScreen(state: update),
      );
    }
    if (!ref.watch(onboardingControllerProvider)) {
      return MaterialApp(
        title: 'CPI GO',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        themeMode: ThemeMode.light,
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
        theme: AppTheme.light,
        themeMode: ThemeMode.light,
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

    return MaterialApp.router(
      title: 'CPI GO',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      themeMode: ThemeMode.light,
      locale: const Locale('fr', 'SN'),
      supportedLocales: _supportedLocales,
      localizationsDelegates: _localizationsDelegates,
      routerConfig: ref.watch(routerProvider),
      builder: (BuildContext context, Widget? child) {
        final DisplaySettings display = ref.watch(displaySettingsProvider);
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
          child: PushDeepLinkListener(child: child ?? const SizedBox.shrink()),
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
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ];

class _BrandSplash extends StatelessWidget {
  const _BrandSplash();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return ColoredBox(
      color: theme.colorScheme.primary,
      child: Stack(
        children: <Widget>[
          const Center(
            child: Image(
              image: AssetImage('assets/brand/cpi-header.png'),
              width: 180,
              height: 74,
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
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onPrimary,
                  ),
                  semanticsLabel: 'Chargement en cours',
                ),
                const SizedBox(height: CpiSpacing.xs),
                Semantics(
                  label: 'Chargement en cours',
                  child: LinearProgressIndicator(
                    minHeight: 3,
                    backgroundColor: cpiTrackOn(theme.colorScheme.primary),
                    color: theme.colorScheme.onPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
