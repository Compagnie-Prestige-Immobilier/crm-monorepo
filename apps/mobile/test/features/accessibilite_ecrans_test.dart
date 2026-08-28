import 'package:cpi_go/core/feedback/feedback.dart';
import 'package:cpi_go/core/notifications/rep_callback_notifications.dart';
import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/about/presentation/about_screen.dart';
import 'package:cpi_go/features/accueil/presentation/registre_screen.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/notifications/notification_inbox.dart';
import 'package:cpi_go/features/notifications/presentation/notifications_screen.dart';
import 'package:cpi_go/features/notifications/rep_callback_due_listener.dart';
import 'package:cpi_go/features/phase2/presentation/callback_picker.dart';
import 'package:cpi_go/features/rappels/presentation/rappels_screen.dart';
import 'package:cpi_go/features/reglages/presentation/reglages_screen.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Ce qu'un lecteur d'écran, Switch Access ou Voice Access trouve sur les
/// écrans.
///
/// Un relevé de l'arbre sémantique réel a montré que plusieurs commandes ne
/// portaient AUCUNE action `tap` : dans un groupe (`FHeader`, `FTileGroup`),
/// `FTappable` laisse le reconnaisseur du groupe prendre le geste et son nœud
/// n'annonce plus que `focus`. Une commande qu'aucune action n'active est hors
/// de portée de tout ce qui ne pointe pas du doigt (WCAG 4.1.2).
void main() {
  late AppDatabase db;
  late FakeApi api;
  late _RetoursNotes retours;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
    retours = _RetoursNotes();
  });

  tearDown(() => db.close());

  /// `testWidgets`, plus le démontage explicite : un `StreamProvider` drift
  /// disposé programme un minuteur que le binding n'a plus d'image pour jouer.
  void ecranTestWidgets(String description, WidgetTesterCallback body) {
    testWidgets(description, (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2340);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await body(tester);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 1));
    });
  }

  Future<Widget> host(Widget screen, {AuthState auth = _commercial}) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        sharedPreferencesProvider.overrideWithValue(prefs),
        authControllerProvider.overrideWith(() => _CompteOuvert(auth)),
        notificationInboxProvider.overrideWithValue(_BoiteMuette()),
        repCallbackNotificationsProvider.overrideWithValue(_AlarmesMuettes()),
        feedbackProvider.overrideWithValue(retours),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        home: screen,
      ),
    );
  }

  /// Réglages observe le coordinateur de synchronisation, qui replanifie sans
  /// jamais se stabiliser : des images comptées, pas `pumpAndSettle`.
  Future<void> peindre(WidgetTester tester, Widget app) async {
    await tester.pumpWidget(app);
    for (int i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  /// Les choix d'affichage vivent dans une feuille depuis que Réglages tient
  /// en une liste de lignes : la ligne « Thème » l'ouvre.
  Future<void> ouvrirLaFeuilleDuTheme(WidgetTester tester) async {
    await tester.ensureVisible(find.text('Thème'));
    await tester.tap(find.text('Thème'));
    for (int i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  group('choix unique', () {
    ecranTestWidgets(
      'une option de thème porte sa question, son état et le geste qui la '
      'choisit',
      (WidgetTester tester) async {
        final SemanticsHandle semantics = tester.ensureSemantics();
        await peindre(tester, await host(const ReglagesScreen()));
        await ouvrirLaFeuilleDuTheme(tester);

        // Relevé avant correctif : `"Systeme" [isButton, isSelected] [focus]`
        // — aucune action, et un nom qui ne disait pas de quelle question il
        // s'agissait. Recherche par nœud et non par texte : « Système » est
        // AUSSI la valeur affichée à droite de la ligne qui ouvre la feuille.
        expect(
          find.semantics.byLabel('Thème : Système'),
          isSemantics(
            isButton: true,
            isSelected: true,
            isInMutuallyExclusiveGroup: true,
            hasTapAction: true,
          ),
        );
        expect(
          find.semantics.byLabel('Thème : Sombre'),
          isSemantics(isSelected: false, hasTapAction: true),
        );

        semantics.dispose();
      },
    );

    ecranTestWidgets('l\'action sémantique choisit vraiment le thème', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle semantics = tester.ensureSemantics();
      await peindre(tester, await host(const ReglagesScreen()));
      await ouvrirLaFeuilleDuTheme(tester);

      tester.semantics.tap(find.semantics.byLabel('Thème : Sombre'));
      for (int i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }

      // Choisir referme la feuille : la ligne porte désormais la valeur.
      expect(find.text('Système'), findsNothing);
      expect(find.text('Sombre'), findsOneWidget);

      await ouvrirLaFeuilleDuTheme(tester);
      expect(
        find.semantics.byLabel('Thème : Sombre'),
        isSemantics(isSelected: true),
      );

      semantics.dispose();
    });
  });

  group('interrupteur', () {
    ecranTestWidgets(
      '« Réduire les animations » n\'est annoncé qu\'une fois, et la ligne '
      'entière bascule',
      (WidgetTester tester) async {
        final SemanticsHandle semantics = tester.ensureSemantics();
        await peindre(tester, await host(const ReglagesScreen()));

        // La ligne est en bas d'une liste devenue plus haute que l'écran
        // depuis que le corps du texte est à 22 : sans ce défilement, le nœud
        // mesuré est celui d'une ligne coupée par le bord.
        await tester.ensureVisible(find.text('Réduire les animations'));
        await tester.pump(const Duration(milliseconds: 50));

        // Avant correctif : le titre de la ligne et le `semanticsLabel` de
        // l'interrupteur disaient tous deux « Réduire les animations », et le
        // geste ne portait que sur les 59×39 dp de l'interrupteur.
        final SemanticsNode ligne = tester.getSemantics(
          find.text('Réduire les animations'),
        );
        expect(
          ligne,
          isSemantics(
            label: 'Réduire les animations. Transitions instantanées',
            hasToggledState: true,
            isToggled: false,
            hasTapAction: true,
          ),
        );
        expect(
          ligne.rect.height,
          greaterThanOrEqualTo(48),
          reason: 'la cible est la ligne entière',
        );

        tester.semantics.tap(
          find.semantics.byLabel(
            'Réduire les animations. Transitions instantanées',
          ),
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 50));

        expect(
          tester.getSemantics(find.text('Réduire les animations')),
          isSemantics(isToggled: true),
        );

        semantics.dispose();
      },
    );

    /// Les deux interrupteurs de retours suivent la même règle que les
    /// animations : un seul nœud, la ligne entière, l'état porté par le nom.
    for (final (String nom, String etat) in const <(String, String)>[
      ('Vibrations', 'Retour au toucher et à l\'enregistrement'),
      ('Sons', 'Coupés en mode silencieux'),
    ]) {
      ecranTestWidgets('« $nom » s\'annonce une fois et bascule en entier', (
        WidgetTester tester,
      ) async {
        final SemanticsHandle semantics = tester.ensureSemantics();
        await peindre(tester, await host(const ReglagesScreen()));

        await tester.ensureVisible(find.text(nom));
        await tester.pump(const Duration(milliseconds: 50));

        final SemanticsNode ligne = tester.getSemantics(find.text(nom));
        expect(
          ligne,
          isSemantics(
            label: '$nom. $etat',
            hasToggledState: true,
            // Vibrations et sons sont allumés à l'installation : sur le
            // terrain personne n'ira les chercher dans les réglages.
            isToggled: true,
            hasTapAction: true,
          ),
        );
        expect(ligne.rect.height, greaterThanOrEqualTo(48));

        tester.semantics.tap(find.semantics.byLabel('$nom. $etat'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 50));

        expect(
          tester.getSemantics(find.text(nom)),
          isSemantics(isToggled: false),
        );

        semantics.dispose();
      });
    }
  });

  group('actions de bandeau', () {
    ecranTestWidgets(
      'le registre d\'un compte accueil ne promet aucun changement de projet',
      (WidgetTester tester) async {
        final SemanticsHandle semantics = tester.ensureSemantics();
        await peindre(
          tester,
          await host(const RegistreScreen(), auth: _accueil),
        );

        // Un seul projet ouvert : la pastille n'est qu'un nom, pas un bouton
        // qui ouvrirait une feuille vide. Les chiffres ont leur onglet.
        expect(find.text('Accueil'), findsOneWidget);
        expect(
          find.bySemanticsLabel('Projet Accueil. Changer de projet'),
          findsNothing,
        );

        semantics.dispose();
      },
    );

    ecranTestWidgets(
      '« Tout marquer comme lu » est un nœud à part, activable',
      (WidgetTester tester) async {
        // Le bouton n'existe que s'il reste quelque chose à marquer : il est
        // en pied d'écran depuis qu'il porte un nom, et non plus en bandeau.
        await db
            .into(db.notifications)
            .insert(
              NotificationsCompanion.insert(
                id: 'ntf-1',
                title: 'Appels en attente',
                body: 'Il vous reste 3 fiches à appeler.',
                createdAt: DateTime.utc(2026, 8, 12, 9),
                receivedAt: DateTime.utc(2026, 8, 12, 9),
              ),
            );

        final SemanticsHandle semantics = tester.ensureSemantics();
        await peindre(tester, await host(const NotificationsScreen()));

        final SemanticsNode action = tester.getSemantics(
          find.bySemanticsLabel('Tout marquer comme lu'),
        );
        expect(
          action,
          isSemantics(
            label: 'Tout marquer comme lu',
            isButton: true,
            hasTapAction: true,
          ),
        );
        expect(action.rect.width, greaterThanOrEqualTo(48));
        expect(action.rect.height, greaterThanOrEqualTo(48));

        semantics.dispose();
      },
    );
  });

  group('roue des demi-heures', () {
    ecranTestWidgets('elle se nomme, se lit et s\'ajuste sans glisser', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle semantics = tester.ensureSemantics();
      final List<DateTime?> choix = <DateTime?>[];
      await tester.pumpWidget(
        await host(
          Material(
            child: SingleChildScrollView(
              child: CallbackPicker(
                now: DateTime.utc(2026, 8, 12, 9, 12),
                onChanged: choix.add,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Choisir une date'));
      await tester.pumpAndSettle();

      // La feuille s'ouvre sur le calendrier : l'heure ne vient qu'après le
      // jour.
      await tester.tap(find.text('12').first);
      await tester.pumpAndSettle();

      expect(
        tester.getSemantics(find.byType(FPicker)),
        isSemantics(
          label: 'Heure du rappel',
          value: '09 h 30',
          increasedValue: '10 h 00',
          hasIncreaseAction: true,
        ),
      );

      tester.semantics.increase(find.semantics.byLabel('Heure du rappel'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Valider'));
      await tester.pumpAndSettle();

      expect(choix.last, DateTime.utc(2026, 8, 12, 10));

      semantics.dispose();
    });
  });

  group('rappel qui tombe par-dessus l\'écran', () {
    Future<void> poserRappel() => db
        .into(db.repCallbackReminders)
        .insert(
          RepCallbackRemindersCompanion.insert(
            id: 'rap-1',
            representantId: 'rep-1',
            fullName: 'Ndeye Fall',
            phoneE164: '+221770000001',
            scheduledAt: DateTime.now().subtract(const Duration(minutes: 5)),
            createdAt: DateTime.now().subtract(const Duration(hours: 1)),
          ),
        );

    ecranTestWidgets('elle se signale par le service, pas par un son système', (
      WidgetTester tester,
    ) async {
      // `SystemSound.play(alert)` ne fait RIEN sur Android : le rappel tombait
      // en silence sur un téléphone posé sur la table.
      final List<String> systeme = <String>[];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (MethodCall call) async {
          if (call.method == 'SystemSound.play') systeme.add(call.method);
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );

      await poserRappel();
      await tester.pumpWidget(
        await host(const RepCallbackDueListener(child: SizedBox.expand())),
      );
      await tester.pump();

      await tester.pump(const Duration(seconds: 21));
      await tester.pumpAndSettle();
      expect(find.text('Rappel'), findsOneWidget);

      expect(retours.joues, <CpiFeedback>[CpiFeedback.rappel]);
      expect(systeme, isEmpty);

      // La feuille n'a plus de « Fermer » : on appelle, ou on reporte.
      await tester.tap(find.text('Plus tard (10 min)'));
      await tester.pumpAndSettle();
    });

    ecranTestWidgets('il attend que le clavier soit refermé', (
      WidgetTester tester,
    ) async {
      await poserRappel();
      final FocusNode saisie = FocusNode();
      addTearDown(saisie.dispose);

      await tester.pumpWidget(
        await host(
          MediaQuery(
            // Clavier ouvert : une saisie est en cours.
            data: const MediaQueryData(
              viewInsets: EdgeInsets.only(bottom: 320),
            ),
            child: RepCallbackDueListener(
              child: Material(child: TextField(focusNode: saisie)),
            ),
          ),
        ),
      );
      await tester.pump();
      saisie.requestFocus();
      await tester.pump();

      await tester.pump(const Duration(seconds: 21));
      await tester.pump();

      expect(
        find.text('Ndeye Fall\n77 000 00 01'),
        findsNothing,
        reason: 'la feuille volerait le focus au milieu d\'un numéro',
      );
      expect(
        saisie.hasFocus,
        isTrue,
        reason: 'le champ garde le focus qu\'on lui a donné',
      );
      // Rien n'est consommé : le rappel reste dû pour le sondage suivant.
      expect((await db.pendingRepCallbackReminders().get()).single.id, 'rap-1');
    });

    ecranTestWidgets('refermée, elle rend le focus à ce qui l\'avait', (
      WidgetTester tester,
    ) async {
      await poserRappel();
      final FocusNode avant = FocusNode(debugLabel: 'avant');
      addTearDown(avant.dispose);

      await tester.pumpWidget(
        await host(
          RepCallbackDueListener(
            // Navigateur imbriqué, comme la coquille de l'application : la
            // feuille s'ouvre dans le navigateur RACINE, et c'est à lui que le
            // focus revient quand elle se referme.
            child: Navigator(
              onGenerateRoute: (RouteSettings _) => MaterialPageRoute<void>(
                builder: (BuildContext _) => Material(
                  child: Focus(
                    focusNode: avant,
                    child: const SizedBox.expand(),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      avant.requestFocus();
      await tester.pump();
      expect(avant.hasFocus, isTrue);

      await tester.pump(const Duration(seconds: 21));
      await tester.pumpAndSettle();
      expect(find.text('Rappel'), findsOneWidget);

      await tester.tap(find.text('Plus tard (10 min)'));
      await tester.pumpAndSettle();

      // Propriété gardée, pas ligne de code : sous `flutter test` le
      // navigateur rend déjà le focus en dépilant sa route. La reprise
      // explicite du listener couvre le cas que ce banc ne reproduit pas — la
      // feuille ouverte dans le navigateur RACINE au-dessus d'un champ vivant
      // dans la coquille, sur appareil.
      expect(
        avant.hasFocus,
        isTrue,
        reason:
            'sans focus repris, le lecteur d\'écran repart du haut de l\'écran',
      );
    });
  });

  group('rappels', () {
    // La ligne empile nom, numéro, heure et pastille : quatre nœuds muets si la
    // fusion n'est pas faite, et le retard n'est alors lisible que par la
    // couleur de la pastille.
    ecranTestWidgets('une ligne annonce qui rappeler, quand, et son retard', (
      WidgetTester tester,
    ) async {
      await db
          .into(db.repCallbackReminders)
          .insert(
            RepCallbackRemindersCompanion.insert(
              id: 'rap-1',
              representantId: 'rep-1',
              fullName: 'Ousmane Fall',
              phoneE164: '+221770000001',
              scheduledAt: DateTime.utc(2026, 8, 12, 8),
              createdAt: t0,
            ),
          );

      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final SemanticsHandle semantics = tester.ensureSemantics();
      // L'horloge se surcharge à la RACINE : un fournisseur qui n'est pas
      // lui-même surchargé se résout dans le conteneur racine, et une
      // surcharge posée dans une portée imbriquée ne l'atteindrait pas.
      await peindre(
        tester,
        ProviderScope(
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            apiPortProvider.overrideWithValue(api),
            sharedPreferencesProvider.overrideWithValue(prefs),
            clockProvider.overrideWithValue(FakeClock(t0)),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            locale: const Locale('fr'),
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            supportedLocales: const <Locale>[Locale('fr')],
            home: const RappelsScreen(),
          ),
        ),
      );

      expect(
        tester.getSemantics(find.text('Ousmane Fall')),
        isSemantics(
          label: 'Ousmane Fall. +221 77 000 00 01. 08:00. En retard.',
          isButton: true,
          hasTapAction: true,
        ),
      );

      semantics.dispose();
    });
  });

  group('à propos', () {
    ecranTestWidgets('chaque ligne annonce sa valeur et la copie', (
      WidgetTester tester,
    ) async {
      final List<Object?> presse = <Object?>[];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (MethodCall call) async {
          if (call.method == 'Clipboard.setData') presse.add(call.arguments);
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );

      final SemanticsHandle semantics = tester.ensureSemantics();
      await peindre(tester, await host(const AboutScreen()));

      // Avant correctif : `semanticsLabel: 'Appui long pour copier.'` — une
      // consigne à la place du nom, pour une action qu'aucun nœud n'exposait.
      expect(
        tester.getSemantics(find.text('Version')),
        isSemantics(
          label: 'Version : 1.0.0. Copier',
          isButton: true,
          hasTapAction: true,
        ),
      );

      tester.semantics.tap(find.semantics.byLabel('Version : 1.0.0. Copier'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(presse.single, <String, Object?>{'text': '1.0.0'});

      semantics.dispose();
    });
  });
}

const AuthState _commercial = AuthState(
  status: AuthStatus.authenticated,
  userId: 'u-1',
  fullName: 'Awa Sy',
  role: 'COMMERCIAL',
  email: 'awa.sy@cpi.sn',
);

const AuthState _accueil = AuthState(
  status: AuthStatus.authenticated,
  userId: 'u-2',
  fullName: 'Fatou Sarr',
  role: 'ACCUEIL',
  email: 'fatou.sarr@cpi.sn',
);

class _CompteOuvert extends AuthController {
  _CompteOuvert(this.etat);

  final AuthState etat;

  @override
  AuthState build() => etat;
}

/// Retours notés, jamais joués : `just_audio` n'a pas de greffon natif sous
/// `flutter test`, et la vibration n'est pas ce qu'on mesure ici.
class _RetoursNotes extends CpiFeedbackService {
  final List<CpiFeedback> joues = <CpiFeedback>[];

  @override
  void jouer(CpiFeedback retour) => joues.add(retour);

  @override
  Future<void> preparer() async {}
}

/// Aucune alarme système : le greffon natif n'existe pas sous `flutter test`.
class _AlarmesMuettes extends RepCallbackNotifications {
  @override
  Future<void> initialize({
    required void Function(RepCallbackTap tap) onAction,
  }) async {}

  @override
  Future<void> schedule({
    required String id,
    required String representantId,
    required String fullName,
    required String phoneE164,
    required DateTime at,
  }) async {}

  @override
  Future<void> cancel(String id) async {}
}

/// Boîte de réception muette : les tests d'interface ne parlent à aucun serveur.
class _BoiteMuette implements NotificationInbox {
  final ValueNotifier<InboxStatus> _status = ValueNotifier<InboxStatus>(
    const InboxStatus.never(),
  );

  @override
  ValueListenable<InboxStatus> get status => _status;

  @override
  Future<int> refresh({bool force = false, int pageSize = 50}) async => 0;

  @override
  Future<void> markRead(String id) async {}

  @override
  void dispose() => _status.dispose();
}
