import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/settings/display_settings.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/about/presentation/about_screen.dart';
import 'package:cpi_go/features/corrections/presentation/corrections_screen.dart';
import 'package:cpi_go/features/historique/presentation/historique_screen.dart';
import 'package:cpi_go/features/home/presentation/home_screen.dart';
import 'package:cpi_go/features/permissions/presentation/battery_help_screen.dart';
import 'package:cpi_go/features/phase2/presentation/phase2_screen.dart';
import 'package:cpi_go/features/reglages/presentation/reglages_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Aucun écran ne doit déborder au réglage de taille le plus grand.
///
/// ## Pourquoi ce test existe
///
/// Le bornage du texte est passé de 1,0–1,3 à 1,0–1,8 pour laisser passer
/// « Très grand » par-dessus un Android déjà réglé au maximum. Élargir un
/// plafond sans mesurer ce qui se trouve dessous, c'est déplacer le débordement
/// plus loin, pas le supprimer.
///
/// Flutter signale un débordement en levant pendant la phase de peinture. Le
/// binding de test collecte ces exceptions ; il suffit donc de peindre chaque
/// écran à 1,8 sur une largeur de 360 dp — la largeur réelle du parc — et de
/// vérifier qu'aucune n'est arrivée.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
  });

  tearDown(() => db.close());

  /// 360 × 780 dp, la surface d'un téléphone du parc, et non les 800 × 600 par
  /// défaut du binding : à 800 dp de large, rien ne déborde jamais.
  void usePhoneSurface(WidgetTester tester) {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  Future<Widget> host(Widget screen, {required CpiTextScale scale}) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        clockProvider.overrideWithValue(FakeClock(t0)),
        sharedPreferencesProvider.overrideWithValue(prefs),
        authControllerProvider.overrideWith(_SignedInController.new),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        home: Builder(
          builder: (BuildContext context) {
            final MediaQueryData media = MediaQuery.of(context);
            return MediaQuery(
              // Exactement le calcul de la racine : réglage système borné, puis
              // multiplié par le choix de l'app, puis reborné.
              data: media.copyWith(
                textScaler: TextScaler.linear(
                  resolveTextScaleFactor(system: media.textScaler, choice: scale),
                ),
              ),
              child: screen,
            );
          },
        ),
      ),
    );
  }

  /// Peint l'écran et rend la main aux minuteurs de drift.
  ///
  /// Sans le démontage explicite, chaque test échoue sur « A Timer is still
  /// pending » : quand un `StreamProvider` drift est disposé,
  /// `StreamQueryStore.markAsClosed` programme un minuteur de durée nulle que
  /// le binding n'a plus aucune image pour exécuter.
  Future<void> paint(WidgetTester tester, Widget app) async {
    await tester.pumpWidget(app);
    // Des images fixes plutôt que `pumpAndSettle` : Réglages observe le
    // coordinateur de synchronisation, qui replanifie et ne se stabilise
    // jamais. Un débordement se détecte de toute façon à la PEINTURE, donc
    // quelques images suffisent à le faire lever.
    for (int i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  /// Tous les écrans que l'utilisateur peut atteindre, sauf la connexion (elle
  /// n'a pas de session) et les formulaires de saisie (leur hauteur est pilotée
  /// par le clavier, qui n'existe pas dans un test de widget).
  final Map<String, Widget Function()> screens = <String, Widget Function()>{
    'Accueil': HomeScreen.new,
    'Réglages': ReglagesScreen.new,
    'Historique': HistoriqueScreen.new,
    'À corriger': CorrectionsScreen.new,
    'Phase 2': Phase2Screen.new,
    'Autorisations': BatteryHelpScreen.new,
    'À propos': AboutScreen.new,
  };

  for (final CpiTextScale scale in CpiTextScale.values) {
    group('taille de texte « ${scale.label} »', () {
      for (final MapEntry<String, Widget Function()> entry in screens.entries) {
        testWidgets('${entry.key} ne déborde pas', (WidgetTester tester) async {
          usePhoneSurface(tester);
          await paint(tester, await host(entry.value(), scale: scale));

          // `takeException` rend la première exception collectée, ou null. Un
          // débordement se présente comme un `FlutterError` dont le message
          // commence par « A RenderFlex overflowed ».
          expect(
            tester.takeException(),
            isNull,
            reason: '${entry.key} déborde à « ${scale.label} » sur 360 dp de large',
          );
        });
      }
    });
  }

  testWidgets('le plafond effectif du texte reste atteignable et borné', (
    WidgetTester tester,
  ) async {
    usePhoneSurface(tester);
    late double applied;
    await tester.pumpWidget(
      await host(
        Builder(
          builder: (BuildContext context) {
            applied = MediaQuery.textScalerOf(context).scale(16) / 16;
            return const SizedBox.shrink();
          },
        ),
        scale: CpiTextScale.extraLarge,
      ),
    );

    expect(applied, closeTo(CpiTextScale.extraLarge.factor, 0.001));
    expect(applied, lessThanOrEqualTo(kCpiMaxTextScale));
    // L'ancien plafond était 1,3 : « Très grand » n'aurait rien changé.
    expect(applied, greaterThan(1.3));
  });
}

/// Session simulée : les écrans lisent le nom et le rôle, pas le réseau.
class _SignedInController extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    userId: 'u-1',
    fullName: 'Awa Sy',
    role: 'COMMERCIAL',
    email: 'awa.sy@cpi.sn',
  );
}
