import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/providers/app_providers.dart';
import 'features/notifications/notifications_controller.dart';
import 'features/notifications/push_deep_link_listener.dart';
import 'core/router/app_router.dart';
import 'core/settings/display_settings.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/auth_state.dart';

/// Racine de l'application.
///
/// Tant que la session n'est pas tranchée, on montre un écran de marque plutôt
/// que de construire le routeur. Construire le routeur trop tôt le ferait
/// démarrer sur `unauthenticated` puis rediriger : l'utilisateur verrait l'écran
/// de connexion clignoter à chaque lancement alors qu'il a une session valide.
class CpiGoApp extends ConsumerWidget {
  const CpiGoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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

    // **Le coordinateur doit vivre aussi longtemps que la session, et démarrer
    // ICI.** C'est un `NotifierProvider` paresseux : il ne se construit qu'au
    // premier `read`/`watch`, et donc ne branche ses cinq déclencheurs — dont le
    // tout premier `run()`, celui qui tire les référentiels — qu'à ce
    // moment-là. Tant que c'était Réglages, Historique ou « À corriger » qui le
    // construisaient en premier, un utilisateur qui se connectait et allait
    // droit à « Nouveau représentant » n'avait AUCUN département, AUCUNE banque
    // et AUCUN syndicat en base locale : le bouton « Enregistrer » ne pouvait
    // jamais s'activer, et l'app était inutilisable sans détour par un onglet
    // sans rapport. Le placer à la racine authentifiée le rend indépendant de
    // la route d'arrivée — y compris une route restaurée qui pointe droit sur
    // un formulaire, hors de la coque de navigation.
    //
    // On observe le *notifier* et non l'état : l'instance est stable, donc la
    // racine — et tout l'arbre sous elle — ne se reconstruit pas à chaque cycle
    // de synchronisation.
    if (auth.isAuthenticated) {
      ref.watch(syncCoordinatorProvider.notifier);
      // Même raisonnement que le coordinateur de synchronisation : le
      // coordinateur push doit vivre aussi longtemps que la session, et
      // démarrer ICI. C'est lui qui consomme le message de lancement d'un
      // démarrage à froid.
      ref.watch(pushCoordinatorProvider.notifier);
    }

    return MaterialApp.router(
      title: 'CPI GO',
      debugShowCheckedModeBanner: false,
      // **Un seul thème, verrouillé en clair.** Pas de `darkTheme`, pas de
      // `ThemeMode.system` : docs/design.md §3 réserve le mode sombre au panel
      // web, et deux thèmes à maintenir pour un poste de saisie n'apportent
      // rien.
      theme: AppTheme.light,
      themeMode: ThemeMode.light,
      locale: const Locale('fr', 'SN'),
      supportedLocales: _supportedLocales,
      localizationsDelegates: _localizationsDelegates,
      routerConfig: ref.watch(routerProvider),
      builder: (BuildContext context, Widget? child) {
        // Taille de texte et animations : le réglage de l'app est multiplié au
        // réglage système, puis borné (voir `display_settings.dart`). C'est le
        // seul endroit où les deux se combinent — aucun écran n'a à le savoir.
        final DisplaySettings display = ref.watch(displaySettingsProvider);
        final MediaQueryData media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(
            textScaler: TextScaler.linear(
              resolveTextScaleFactor(system: media.textScaler, choice: display.textScale),
            ),
            // « Réduire les animations » emprunte le chemin de code système :
            // `CpiMotion.of` lit `MediaQuery.maybeDisableAnimationsOf` et ramène
            // toutes les durées à zéro, sans qu'aucun widget ne connaisse le
            // réglage.
            disableAnimations: media.disableAnimations || display.reduceMotion,
          ),
          // Monté SOUS le `Router` : c'est la seule position d'où `context.go`
          // atteint le routeur réel, et donc d'où un lien profond peut être
          // rejoué après la résolution du garde.
          child: PushDeepLinkListener(child: child ?? const SizedBox.shrink()),
        );
      },
    );
  }
}

const List<Locale> _supportedLocales = <Locale>[Locale('fr', 'SN'), Locale('fr')];

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
    return const ColoredBox(
      color: Color(0xFF630210),
      child: Center(
        child: Image(
          image: AssetImage('assets/brand/cpi-header.png'),
          width: 180,
          height: 74,
          fit: BoxFit.contain,
          semanticLabel: 'CPI',
        ),
      ),
    );
  }
}
