import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/settings/display_settings.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/draft_repository.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/about/presentation/about_screen.dart';
import 'package:cpi_go/features/corrections/presentation/corrections_screen.dart';
import 'package:cpi_go/features/historique/presentation/historique_screen.dart';
import 'package:cpi_go/features/home/presentation/home_screen.dart';
import 'package:cpi_go/features/permissions/presentation/battery_help_screen.dart';
import 'package:cpi_go/features/phase2/presentation/phase2_screen.dart';
import 'package:cpi_go/features/prospect/presentation/prospect_entry_screen.dart';
import 'package:cpi_go/features/reglages/presentation/reglages_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_form_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_picker_screen.dart';
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
/// écran à 1,8 sur une largeur de 360 dp : la largeur réelle du parc : et de
/// vérifier qu'aucune n'est arrivée.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();

    // Un représentant, pour que la saisie de prospects s'ouvre sur le VRAI
    // formulaire. Sans lui, l'écran rend son état vide « Aucun représentant
    // sélectionné » : la liste des champs et la barre d'enregistrement, c'est-à-
    // dire tout ce qui déborde, n'était jamais peinte.
    await insertRepresentant(
      db,
      id: 'repA',
      phone: '+221770000001',
      fullName: 'Mamadou Diallo Ndiaye',
    );

    // Un brouillon vieux d'une heure sur chaque formulaire : entre 60 s et
    // 7 jours, `DraftRepository` le classe « reprenable » et l'écran affiche le
    // bandeau de reprise. Ce bandeau porte deux `TextButton` dans la même ligne
    // que son message : c'est la troisième variante du débordement, et elle
    // n'était couverte par rien parce qu'aucun test ne posait de brouillon.
    for (final MapEntry<String, Map<String, Object?>> draft
        in <String, Map<String, Object?>>{
          'representant.create': <String, Object?>{
            'fullName': 'Mamadou Diallo Ndiaye',
            'phone': '77 000 00 01',
          },
          'prospect.create': <String, Object?>{
            'nom': 'Ndiaye',
            'prenom': 'Fatou',
            'representantId': 'repA',
          },
        }.entries) {
      await DraftRepository(
        db,
        clock: FakeClock(t0.subtract(const Duration(hours: 1))),
      ).save(draftId: 'draft-${draft.key}', formKey: draft.key, values: draft.value);
    }
  });

  tearDown(() => db.close());

  /// Deux surfaces, parce qu'une seule ne couvre pas le parc.
  ///
  /// 360 dp est la largeur courante ; 320 dp est celle des entrées de gamme
  /// encore vendues au Sénégal (Itel A-series, Tecno Pop) et des appareils dont
  /// l'utilisateur a poussé la densité d'affichage système. Quarante dp de
  /// moins, c'est un `Row` d'icône + libellé + valeur qui ne rentre plus, et
  /// c'est exactement là que les débordements survivent aux tests.
  void useSurface(WidgetTester tester, {required double widthDp}) {
    const double dpr = 3;
    tester.view.physicalSize = Size(widthDp * dpr, 780 * dpr);
    tester.view.devicePixelRatio = dpr;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  void usePhoneSurface(WidgetTester tester) => useSurface(tester, widthDp: 360);

  /// ═══ LE RÉGLAGE SYSTÈME EST UNE DIMENSION À PART ENTIÈRE ═══
  ///
  /// Le facteur appliqué n'est PAS le choix de l'app : c'est le réglage Android
  /// (borné à 1,3) MULTIPLIÉ par ce choix (au plus 1,35), le tout borné à 1,8.
  /// Le balayage ne réglait que le choix de l'app et laissait le système à 1,0 :
  /// il ne dépassait donc jamais 1,35, alors que la doc-block du fichier et le
  /// commentaire de `kCpiMaxTextScale` affirmaient tous deux que « chaque écran
  /// a été vérifié à ce plafond ». Le plafond réellement atteignable, 1,3 × 1,35
  /// = 1,755, n'avait été peint par personne : c'est exactement là que
  /// survivaient les débordements restants.
  Future<Widget> host(
    Widget screen, {
    required CpiTextScale scale,
    double systemFactor = 1,
  }) async {
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
                  resolveTextScaleFactor(
                    system: TextScaler.linear(systemFactor),
                    choice: scale,
                  ),
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
  /// n'a pas de session).
  ///
  /// ═══ LES DEUX FORMULAIRES SONT DEDANS MAINTENANT ═══
  ///
  /// Ils en étaient explicitement exclus, au motif que « leur hauteur est
  /// pilotée par le clavier ». C'était exclure du balayage les DEUX écrans les
  /// plus exposés : ce sont les seuls à empiler libellés, champs, messages de
  /// validation et barre d'enregistrement épinglée dans la même colonne, et un
  /// message d'erreur de deux lignes à 1,8 fois la taille de texte est
  /// précisément ce qui déborde. Le clavier ne change d'ailleurs que la
  /// hauteur DISPONIBLE, et un `RenderFlex` déborde à la peinture avec ou sans
  /// lui : le motif de l'exclusion ne tenait pas.
  final Map<String, Widget Function()> screens = <String, Widget Function()>{
    'Accueil': HomeScreen.new,
    'Réglages': ReglagesScreen.new,
    'Historique': HistoriqueScreen.new,
    'À corriger': CorrectionsScreen.new,
    'Phase 2': Phase2Screen.new,
    'Autorisations': BatteryHelpScreen.new,
    'À propos': AboutScreen.new,
    'Choisir un représentant': RepresentantPickerScreen.new,
    // ═══ LES DEUX FORMULAIRES SONT DANS LE BALAYAGE, SANS `skip` ═══
    //
    // Ils y sont entrés en portant un débordement réel : « Nouveau
    // représentant » débordait de 145 px à 320 dp en taille NORMALE, et les
    // deux débordaient à 360 dp dès « Grand ». Trois causes, toutes corrigées
    // dans les écrans eux-mêmes et non ici : un `PreferredSize` de hauteur fixe
    // sous un texte qui grandit, une barre d'enregistrement qui empilait sans
    // plafond, et des `Row` de `TextButton` pleins qui ne savaient pas passer à
    // la ligne.
    'Nouveau représentant': RepresentantFormScreen.new,
    'Saisie de prospects sans représentant': ProspectEntryScreen.new,
    'Saisie de prospects': () => const ProspectEntryScreen(representantId: 'repA'),
  };

  for (final double widthDp in <double>[360, 320]) {
    // 1,0 : l'utilisateur n'a pas touché aux réglages Android. 1,3 : il les a
    // poussés au maximum, ce que fait tout le monde passé quarante ans, et ce
    // que `kCpiMaxSystemTextScale` accepte.
    for (final double systemFactor in <double>[1, kCpiMaxSystemTextScale]) {
      for (final CpiTextScale scale in CpiTextScale.values) {
        final double applied = resolveTextScaleFactor(
          system: TextScaler.linear(systemFactor),
          choice: scale,
        );
        group('${widthDp.toInt()} dp · système $systemFactor× · « ${scale.label} » '
            '(${applied.toStringAsFixed(2)}×)', () {
          for (final MapEntry<String, Widget Function()> entry in screens.entries) {
            testWidgets('${entry.key} ne déborde pas', (WidgetTester tester) async {
              useSurface(tester, widthDp: widthDp);
              await paint(
                tester,
                await host(entry.value(), scale: scale, systemFactor: systemFactor),
              );

              // `takeException` rend la première exception collectée, ou null. Un
              // débordement se présente comme un `FlutterError` dont le message
              // commence par « A RenderFlex overflowed ».
              expect(
                tester.takeException(),
                isNull,
                reason:
                    '${entry.key} déborde à ${applied.toStringAsFixed(2)}× sur '
                    '${widthDp.toInt()} dp de large',
              );
            });
          }
        });
      }
    }
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
