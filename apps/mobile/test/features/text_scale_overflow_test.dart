import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/phase2_directory_sync.dart';
import 'package:cpi_go/core/settings/display_settings.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/draft_repository.dart';
import 'package:cpi_go/core/updates/app_update_controller.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/campagnes/presentation/campagne_file_screen.dart';
import 'package:cpi_go/features/campagnes/presentation/campagnes_screen.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/auth/presentation/login_screen.dart';
import 'package:cpi_go/features/notifications/presentation/notifications_screen.dart';
import 'package:cpi_go/features/onboarding/presentation/onboarding_screen.dart';
import 'package:cpi_go/features/updates/presentation/app_update_screen.dart';
import 'package:cpi_go/features/about/presentation/about_screen.dart';
import 'package:cpi_go/features/accueil/presentation/registre_screen.dart';
import 'package:cpi_go/features/accueil/presentation/visite_form_screen.dart';
import 'package:cpi_go/features/corrections/presentation/corrections_screen.dart';
import 'package:cpi_go/features/historique/presentation/historique_screen.dart';
import 'package:cpi_go/features/home/presentation/home_screen.dart';
import 'package:cpi_go/features/permissions/presentation/battery_help_screen.dart';
import 'package:cpi_go/features/shell/grand_public_screen.dart';
import 'package:cpi_go/features/shell/hub_screen.dart';
import 'package:cpi_go/features/phase2/presentation/callback_picker.dart';
import 'package:cpi_go/features/phase2/presentation/phase2_screen.dart';
import 'package:cpi_go/features/prospect/presentation/prospect_entry_screen.dart';
import 'package:cpi_go/features/reglages/presentation/reglages_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_detail_screen.dart';
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

    // La fiche de représentant dans son état le plus haut : notes multi-lignes,
    // IEF absente, et un prospect à lister.
    await insertRepresentant(
      db,
      id: 'repFiche',
      phone: '+221770000002',
      fullName: 'Abdoulaye Ousseynou Kane Diagne',
      // La fiche dans son état le plus large : un WhatsApp sur un AUTRE numéro
      // et la profession la plus longue des puces.
      whatsappStatus: 'AUTRE_NUMERO',
      whatsappE164: '+221781112233',
      profession: 'Personnel administratif',
      notes:
          'Disponible entre midi et quatorze heures, jamais le vendredi '
          'apres-midi. Passe par le secretariat de l\'inspection.',
    );
    await insertProspect(
      db,
      id: 'proFiche',
      representantId: 'repFiche',
      phone: '+221780000002',
    );
    // Le fil dans son état le plus large : une entrée dont le corps ET la ligne
    // d'auteur passent à la ligne. Un fil vide ne peint que son état vide, et
    // c'est l'entrée qui porte le risque.
    await insertComment(
      db,
      id: 'comFiche',
      representantId: 'repFiche',
      body:
          'Ne repasse jamais avant la fin des cours. Le secretariat de '
          'l\'inspection prend les messages entre midi et quatorze heures.',
      authorName: 'Ndeye Astou Mbengue Sarr',
    );

    // Une campagne dans son état le plus large : un nom rédigé depuis le web,
    // une file étalée sur assez de jours pour que l'en-tête porte deux nombres,
    // et un rang à trois chiffres devant un nom complet.
    await insertCampagne(
      db,
      id: 'campFiche',
      name: 'Enseignants du moyen secondaire, region de Ziguinchor',
      spreadDays: 7,
    );
    await insertProspect(
      db,
      id: 'proCampagne',
      representantId: 'repFiche',
      phone: '+221780000003',
      nom: 'Kane Diagne',
      prenom: 'Abdoulaye Ousseynou',
    );
    await insertTache(
      db,
      id: 'tacheCampagne',
      campaignId: 'campFiche',
      prospectId: 'proCampagne',
      position: 128,
      dayIndex: 3,
    );

    // Les intitulés les plus longs du classeur : c'est eux qui débordent. Les
    // listes viennent de la base, le formulaire n'appelle plus rien.
    for (final (String id, String kind, String label)
        in <(String, String, String)>[
          ('e1', 'entreprises', 'MAKE-UP ADDICTION'),
          ('d1', 'directions', 'MARKETING COMMUNICATION'),
          (
            't1',
            'destinataires',
            'MME. DIOUM YAMA (Ass Rh et Commerciale Argile)',
          ),
          ('o1', 'objets', 'ACHAT PRODUITS SANTARGILE ET/OU MAKE-UP'),
        ]) {
      await db
          .into(db.visiteReferentiels)
          .insert(
            VisiteReferentielsCompanion.insert(
              id: id,
              kind: kind,
              code: id.toUpperCase(),
              label: label,
              localUpdatedAt: t0,
            ),
          );
    }

    // Le registre dans son état le plus large : les intitulés les plus longs
    // du classeur, une référence, un téléphone et les quatre listes remplies.
    await insertVisite(
      db,
      id: 'v1',
      date: '2026-08-12',
      time: '11:08',
      visitorName: 'Abdoulaye Ousseynou Kane Diagne',
      phone: '+33 6 12 34 56 78',
      entrepriseId: 'e1',
      entrepriseLabel: 'MAKE-UP ADDICTION',
      objetId: 'o1',
      objetLabel: 'ACHAT PRODUITS SANTARGILE ET/OU MAKE-UP',
      directionId: 'd1',
      directionLabel: 'MARKETING COMMUNICATION',
      destinataireId: 't1',
      destinataireLabel: 'MME. DIOUM YAMA (Ass Rh et Commerciale Argile)',
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
      ).save(
        draftId: 'draft-${draft.key}',
        formKey: draft.key,
        values: draft.value,
      );
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

  /// Les écrans de **premier niveau**, dans leur état d'ouverture.
  ///
  /// ═══ CE QUE CETTE LISTE COUVRE, ET CE QU'ELLE NE COUVRE PAS ═══
  ///
  /// Elle se donnait pour « tous les écrans que l'utilisateur peut atteindre,
  /// sauf la connexion ». C'était faux, et une exhaustivité qu'on croit acquise
  /// est pire que pas de balayage du tout : elle éteint la question. Quatre
  /// écrans de premier niveau manquaient, dont la connexion elle-même ; ils
  /// sont ajoutés ci-dessous.
  ///
  /// **Ce qui reste dehors, énoncé pour ne pas se rendormir dessus** :
  ///
  /// * les états NON INITIAUX des écrans listés : le formulaire en mode
  ///   MODIFICATION (`?id=`), les listes remplies, les états d'erreur ;
  /// * les modales et feuilles : `_NegativeSheet`, `_Capture`, `_MethodCard`,
  ///   `_AlreadyClosed` de la phase 2, `showOwnershipSheet`, la boîte de
  ///   déconnexion avec saisies en attente. Le choix de l'heure de rappel, lui,
  ///   est peint directement : ses six puces sont la forme la plus large de la
  ///   feuille, et elles sont arrivées avec un `Wrap` à prouver.
  ///
  /// Ce sont des formes à risque, pas des oublis anodins : une feuille modale
  /// empile des boutons pleine largeur dans une colonne contrainte, c'est-à-dire
  /// exactement la géométrie qui débordait sur les formulaires. Les peindre
  /// demande de piloter chaque écran jusqu'à l'état qui les ouvre, ce que ce
  /// balayage-ci ne sait pas faire : il construit des widgets, il ne joue pas de
  /// parcours. Tant que ce travail n'est pas fait, la liste dit ce qu'elle
  /// couvre et rien de plus.
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
    // Le hub est le premier ecran d'une session : trois tuiles d'icone,
    // titre et sous-titre sur une seule ligne de `Row`, c'est-a-dire la
    // geometrie qui deborde en premier quand le texte grandit.
    'Projets': HubScreen.new,
    'Projet Grand Public': GrandPublicScreen.new,
    'Accueil': HomeScreen.new,
    'Réglages': ReglagesScreen.new,
    'Historique': HistoriqueScreen.new,
    'À corriger': CorrectionsScreen.new,
    'Phase 2': Phase2Screen.new,
    'Autorisations': BatteryHelpScreen.new,
    'À propos': AboutScreen.new,
    'Choisir un représentant': RepresentantPickerScreen.new,
    'Fiche représentant': () =>
        const RepresentantDetailScreen(representantId: 'repFiche'),
    // Peint à part, comme « Heure de rappel » : le fil est en bas du `ListView`
    // de la fiche, donc hors des 780 dp peints ici, donc jamais construit. Un
    // débordement y serait passé sans que rien ne le dise.
    'Fil de commentaires': () => const Scaffold(
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: RepresentantCommentThread(representantId: 'repFiche'),
      ),
    ),
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
    'Saisie de prospects': () =>
        const ProspectEntryScreen(representantId: 'repA'),
    // Les quatre que la liste oubliait en se croyant complète. Trois sont
    // atteignables sans session ou juste après, donc jamais vus par un
    // balayage qui partait de l'accueil.
    // Le registre des visites : la ligne empile heure, référence, nom et une
    // suite d'intitulés du classeur qui ne tiennent pas sur une ligne, et le
    // formulaire empile quatre champs de choix sous une barre épinglée.
    // Le registre se cloisonne sur le rôle : peint sous le compte du
    // téléconseiller, il ne rendrait que son refus d'accès.
    'Registre des visites': () => ProviderScope(
      overrides: [authControllerProvider.overrideWith(_AccueilController.new)],
      child: const RegistreScreen(),
    ),
    'Inscrire un visiteur': VisiteFormScreen.new,
    'Connexion': LoginScreen.new,
    'Premier lancement': OnboardingScreen.new,
    'Notifications': NotificationsScreen.new,
    // Les campagnes : le nom que l'équipe du client a rédigé, suivi d'un compte
    // et d'un nombre de jours sur la même ligne de sous-titre. La file, elle,
    // porte un en-tête de jour et un rang collé au nom de la fiche.
    'Campagnes': CampagnesScreen.new,
    'File de campagne': () => const CampagneFileScreen(campaignId: 'campFiche'),
    // Le contenu de la feuille des issues négatives quand l'issue est
    // « À rappeler » : six puces de largeurs très inégales, dont
    // « Cet après-midi (15 h) ».
    'Heure de rappel': () => Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: CallbackPicker(now: t0, onChanged: (DateTime? _) {}),
      ),
    ),
    // La feuille des issues n'est plus une liste figée de cinq puces : elle rend
    // ce que l'équipe du client a rédigé depuis le web, sous des en-têtes
    // d'effet. Ni la longueur des libellés ni leur nombre ne sont désormais
    // connus à la compilation, et c'est exactement ce qui déborde.
    'Feuille des issues': () => Scaffold(
      body: CallOutcomeSheet(now: t0, reasons: _reasons),
    ),
    // Version longue et notes multi-lignes : c'est l'état le plus haut de
    // l'écran, et `forceUpdate` retire le bouton « Plus tard », ce qui change
    // la barre d'actions.
    'Mise à jour obligatoire': () => AppUpdateScreen(
      state: AppUpdateState(
        status: AppUpdateStatus.ready,
        localPath: '/data/cpi-go.apk',
        release: AndroidRelease(
          forceUpdate: true,
          versionName: '2.14.0-hotfix.3',
          versionCode: 21403,
          fileSize: 48234567,
          sha256: 'a' * 64,
          downloadUrl: 'https://exemple.test/cpi-go.apk',
          notes:
              'Correction de la synchronisation hors ligne et de la reprise '
              'des saisies interrompues sur les appareils Transsion.',
        ),
      ),
    ),
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
          for (final MapEntry<String, Widget Function()> entry
              in screens.entries) {
            testWidgets('${entry.key} ne déborde pas', (
              WidgetTester tester,
            ) async {
              useSurface(tester, widthDp: widthDp);
              await paint(
                tester,
                await host(
                  entry.value(),
                  scale: scale,
                  systemFactor: systemFactor,
                ),
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

/// L'accueil, pour peindre le registre des visites plutôt que son refus d'accès.
class _AccueilController extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    userId: 'u-2',
    fullName: 'Fatou Sarr',
    role: 'ACCUEIL',
    email: 'fatou.sarr@cpi.sn',
  );
}

/// Des motifs aussi longs que ce que l'équipe du client peut écrire, sur les
/// quatre effets que la feuille regroupe.
const List<CallReason> _reasons = <CallReason>[
  CallReason(
    code: 'NRP',
    label: 'Ne répond pas après trois tentatives espacées',
    effect: CallEffects.keepOpen,
    sortOrder: 10,
  ),
  CallReason(
    code: 'OCCUPE',
    label: 'Ligne occupée ou renvoi vers messagerie vocale',
    effect: CallEffects.keepOpen,
    requiresComment: true,
    sortOrder: 20,
  ),
  CallReason(
    code: 'RDV_PRIS',
    label: 'Rendez-vous pris pour une présentation détaillée',
    effect: CallEffects.scheduleCallback,
    sortOrder: 30,
  ),
  CallReason(
    code: 'REFUS_CONJOINT',
    label: 'Refus après consultation du conjoint',
    effect: CallEffects.closeRefused,
    sortOrder: 40,
  ),
  CallReason(
    code: 'HORS_SERVICE',
    label: 'Numéro attribué à un autre abonné',
    effect: CallEffects.closeWrongNumber,
    sortOrder: 50,
  ),
];
