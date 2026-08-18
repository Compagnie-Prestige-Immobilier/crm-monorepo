import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/phase2_directory_sync.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/theme/cpi_tokens.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/phase2/presentation/phase2_screen.dart';
import 'package:drift/drift.dart' hide isNotNull, isNull;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Tests d'interface de l'écran de phase 2.
///
/// Ils portent sur les propriétés qu'un commercial paie s'il les perd : une
/// cible qu'on rate au soleil, une animation qui donne la nausée à quelqu'un qui
/// a désactivé le mouvement, un écran muet pour un lecteur d'écran.
/// `testWidgets`, plus le démontage explicite de l'arbre à la fin.
///
/// Sans lui, chaque test échoue sur « A Timer is still pending even after the
/// widget tree was disposed », puis part en délai de dix minutes. La cause n'est
/// ni l'écran ni Riverpod : quand un `StreamProvider` de drift est disposé,
/// `StreamQueryStore.markAsClosed` programme un minuteur de durée nulle pour
/// libérer la requête. Le binding de test démonte l'arbre APRÈS le dernier
/// `pump`, donc ce minuteur n'a plus aucune image pour s'exécuter et reste en
/// suspens.
///
/// Remonter un arbre vide puis pomper une image rend la main au minuteur avant
/// la vérification d'invariants. C'est la seule manière de faire cohabiter des
/// flux drift et `testWidgets`, et elle est ici plutôt que recopiée quinze fois.
void phase2TestWidgets(String description, WidgetTesterCallback body) {
  testWidgets(description, (WidgetTester tester) async {
    // Surface d'un téléphone réel (360 × 780 dp), pas les 800 × 600 par défaut
    // du binding de test. Sur 600 dp de haut, l'action « Méthode non obtenue »
    // tombe hors de l'écran et les tests d'appui échouent pour une raison qui
    // n'existe sur aucun appareil.
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await body(tester);
    await tester.pumpWidget(const SizedBox.shrink());
    // Une image de durée NON nulle : `pump(Duration.zero)` ne fait pas avancer
    // l'horloge simulée, et un minuteur programmé à « maintenant » n'est alors
    // jamais éligible. Une milliseconde suffit et ne coûte rien.
    await tester.pump(const Duration(milliseconds: 1));
  });
}

void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    db = await openTestDatabase();
    api = FakeApi();
    await db
        .into(db.phase2Directory)
        .insert(
          Phase2DirectoryCompanion.insert(
            prospectId: 'pros-1',
            phoneE164: '+221771234567',
            updatedAt: t0,
          ),
        );
    await db
        .into(db.phase2Directory)
        .insert(
          Phase2DirectoryCompanion.insert(
            prospectId: 'pros-2',
            phoneE164: '+221781234567',
            phase2Status: const Value<String>(Phase2Statuses.methodObtained),
            enrollmentMethod: const Value<String?>(EnrollmentMethods.physical),
            rev: const Value<int>(4),
            updatedAt: t0,
          ),
        );
  });

  tearDown(() => db.close());

  Widget host({bool disableAnimations = false, Phase2DirectorySync? directory}) {
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        clockProvider.overrideWithValue(FakeClock(t0)),
        if (directory != null) phase2DirectoryProvider.overrideWithValue(directory),
        // Session simulée. Sans elle, `recordCallAttempt` n'a pas d'auteur à
        // écrire et refuse la saisie : le test échouerait sur l'absence de
        // session, pas sur ce qu'il prétend vérifier.
        authControllerProvider.overrideWith(_SignedInController.new),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: disableAnimations),
          child: const Phase2Screen(),
        ),
      ),
    );
  }

  /// Tape un numéro dans le champ et laisse la recherche s'exécuter.
  Future<void> type(WidgetTester tester, String digits) async {
    await tester.enterText(find.byType(TextField).first, digits);
    await tester.pumpAndSettle();
  }

  phase2TestWidgets('le champ prend le focus tout seul : aucun appui préalable', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await tester.pump();

    final EditableText field = tester.widget<EditableText>(
      find.descendant(
        of: find.byType(TextField).first,
        matching: find.byType(EditableText),
      ),
    );
    expect(field.focusNode.hasFocus, isTrue);
  });

  phase2TestWidgets('un numéro connu et ouvert ouvre les trois cartes de méthode', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '771234567');

    expect(find.text('Plateforme'), findsOneWidget);
    expect(find.text('Physique'), findsOneWidget);
    expect(find.text('Voix / messagerie électronique'), findsOneWidget);
    expect(find.text('Méthode non obtenue'), findsOneWidget);
  });

  phase2TestWidgets('les cibles tactiles font au moins 48 dp', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '771234567');

    // 48 dp est le plancher, pas la cible : l'app se tient debout, au soleil,
    // souvent à une main. Une carte qui porte la décision de tout l'écran est
    // dimensionnée bien au-delà.
    for (final String label in const <String>[
      'Plateforme',
      'Physique',
      'Voix / messagerie électronique',
      'Méthode non obtenue',
    ]) {
      final Finder tappable = find.ancestor(
        of: find.text(label),
        matching: find.byWidgetPredicate(
          (Widget w) => w is InkWell || w is OutlinedButton,
        ),
      );
      final Size size = tester.getSize(tappable.first);
      expect(
        size.height,
        greaterThanOrEqualTo(48),
        reason: '« $label » doit couvrir au moins 48 dp',
      );
    }
  });

  phase2TestWidgets('un dossier déjà clos est en lecture seule, sans issue de saisie', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '781234567');

    expect(find.text('Dossier déjà traité'), findsOneWidget);
    expect(find.text('Méthode obtenue'), findsOneWidget);
    expect(find.textContaining('Modifiable par un administrateur'), findsOneWidget);
    // Aucune carte de saisie : le serveur refuserait l'écriture, et proposer un
    // formulaire qui ne peut pas aboutir ferait perdre du temps au commercial.
    expect(find.text('Plateforme'), findsNothing);
    expect(find.text('Méthode non obtenue'), findsNothing);
  });

  phase2TestWidgets('un numéro inconnu de l\'annuaire est signalé sans blocage', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '765555555');

    expect(find.textContaining('Numéro absent de l\'annuaire'), findsOneWidget);
    expect(find.text('Effacer et recommencer'), findsOneWidget);
  });

  phase2TestWidgets('OTHER sans commentaire est refusé DANS la feuille, avant écriture', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '771234567');

    await tester.ensureVisible(find.text('Méthode non obtenue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Méthode non obtenue'));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Autre'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Autre'));
    await tester.pumpAndSettle();

    // La feuille est défilable et le bouton peut être sous la ligne de
    // flottaison sur un petit écran : sans ce défilement, `tap()` rate sa cible
    // et n'avertit que dans un `warnIfMissed` que rien ne lit.
    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    // La feuille reste ouverte avec son message : rien n'est parti en base, donc
    // rien ne sera refusé trois semaines plus tard par un CHECK PostgreSQL.
    expect(find.textContaining('commentaire est obligatoire'), findsOneWidget);
    expect(await db.countMyAttempts().getSingle(), 0);
  });

  phase2TestWidgets('OTHER commenté s\'enregistre et confirme', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '771234567');

    await tester.ensureVisible(find.text('Méthode non obtenue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Méthode non obtenue'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Autre'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Autre'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(
      find.widgetWithText(TextField, 'Commentaire (obligatoire)'),
    );
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Commentaire (obligatoire)'),
      'Le numéro est celui d\'une boutique.',
    );
    await tester.pumpAndSettle();
    // La feuille est défilable et le bouton peut être sous la ligne de
    // flottaison sur un petit écran : sans ce défilement, `tap()` rate sa cible
    // et n'avertit que dans un `warnIfMissed` que rien ne lit.
    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    expect(find.text('Enregistré'), findsOneWidget);
    expect(await db.countMyAttempts().getSingle(), 1);
    // La saisie est en file, pas envoyée : c'est le moteur qui décidera quand.
    expect(await db.countPhase2Pending().getSingle(), 1);
  });

  /// Ouvre la feuille des issues négatives et choisit une issue.
  Future<void> chooseOutcome(WidgetTester tester, String label) async {
    await tester.ensureVisible(find.text('Méthode non obtenue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Méthode non obtenue'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text(label));
    await tester.pumpAndSettle();
    await tester.tap(find.text(label));
    await tester.pumpAndSettle();
  }

  // ═══ L'HEURE DE RAPPEL SE SAISIT SANS CLAVIER ═══
  //
  // Le terrain saisit debout, souvent d'une main : un clavier de date couvre la
  // moitié de l'écran et demande une frappe exacte. Les puces sont l'exigence,
  // pas le confort.
  phase2TestWidgets('« À rappeler » propose des heures, en un seul appui', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '771234567');
    await chooseOutcome(tester, 'À rappeler');

    expect(find.text('Dans 1 h'), findsOneWidget);
    expect(find.text('Demain 9 h'), findsOneWidget);
    expect(find.text('Autre heure'), findsOneWidget);
  });

  phase2TestWidgets('une autre issue n\'offre pas d\'heure de rappel', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '771234567');
    await chooseOutcome(tester, 'Refus');

    expect(find.text('Demain 9 h'), findsNothing);
  });

  phase2TestWidgets('l\'heure choisie est enregistrée avec la tentative', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '771234567');
    await chooseOutcome(tester, 'À rappeler');

    await tester.ensureVisible(find.text('Demain 9 h'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Demain 9 h'));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    final CallAttempt attempt = (await db.select(db.callAttempts).get()).single;
    expect(attempt.outcome, CallOutcomes.callback);
    // `t0` vaut le 12 août 2026 à 9 h : « Demain 9 h » est donc le 13 à 9 h,
    // heure de Dakar, c'est-à-dire UTC toute l'année.
    expect(attempt.callbackAt, DateTime.utc(2026, 8, 13, 9));
  });

  // Le champ est FACULTATIF côté serveur pour les téléphones déjà déployés :
  // l'écran ne doit pas le rendre obligatoire dans leur dos.
  phase2TestWidgets('un rappel sans heure s\'enregistre quand même', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '771234567');
    await chooseOutcome(tester, 'À rappeler');

    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    expect(find.text('Enregistré'), findsOneWidget);
    final CallAttempt attempt = (await db.select(db.callAttempts).get()).single;
    expect(attempt.callbackAt, isNull);
  });

  phase2TestWidgets('« Numéro suivant » vide le champ et lui rend le focus', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '781234567');

    await tester.ensureVisible(find.text('Numéro suivant'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Numéro suivant'));
    await tester.pumpAndSettle();

    final EditableText field = tester.widget<EditableText>(
      find.descendant(
        of: find.byType(TextField).first,
        matching: find.byType(EditableText),
      ),
    );
    expect(field.controller.text, isEmpty);
    expect(field.focusNode.hasFocus, isTrue);
    expect(find.text('Dossier déjà traité'), findsNothing);
  });

  phase2TestWidgets(
    'mouvement réduit : les durées tombent à zéro, la logique ne change pas',
    (WidgetTester tester) async {
      await tester.pumpWidget(host(disableAnimations: true));
      await tester.pump();

      final BuildContext context = tester.element(find.byType(Phase2Screen));
      expect(CpiMotion.of(context).component, Duration.zero);

      final AnimatedSwitcher switcher = tester.widget<AnimatedSwitcher>(
        find.byType(AnimatedSwitcher),
      );
      expect(switcher.duration, Duration.zero);

      // La logique, elle, est identique : le même numéro donne le même écran.
      await type(tester, '771234567');
      expect(find.text('Plateforme'), findsOneWidget);
    },
  );

  phase2TestWidgets('rien ne vibre à la frappe', (WidgetTester tester) async {
    // Une vibration par caractère transformerait la saisie d'un numéro en
    // bourdonnement continu, et userait la batterie d'une journée d'appels.
    final List<String> haptics = <String>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (MethodCall call) async {
        if (call.method == 'HapticFeedback.vibrate') {
          haptics.add(call.arguments.toString());
        }
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );

    await tester.pumpWidget(host());
    // Numéro incomplet : on tape, il ne se passe rien d'autre que de la frappe.
    await tester.enterText(find.byType(TextField).first, '7712345');
    await tester.pumpAndSettle();
    expect(haptics, isEmpty);

    // Numéro complet et connu : toujours rien, la recherche a abouti.
    await type(tester, '771234567');
    expect(haptics, isEmpty);

    // Choix d'une carte : retour de SÉLECTION, exact au moment où il est émis.
    await tester.tap(find.text('Plateforme'));
    await tester.pumpAndSettle();
    expect(haptics, isNotEmpty);
    expect(await db.countMyAttempts().getSingle(), 1);
  });

  phase2TestWidgets('l\'écran est lisible par un lecteur d\'écran', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await tester.pumpWidget(host());
    await type(tester, '771234567');

    expect(find.bySemanticsLabel(RegExp('Méthode obtenue : Plateforme')), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('Numéro appelé, neuf chiffres')), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('appels consignés')), findsOneWidget);
    handle.dispose();
  });

  phase2TestWidgets('l\'annuaire vide invite à le télécharger avant de commencer', (
    WidgetTester tester,
  ) async {
    await db.delete(db.phase2Directory).go();
    await tester.pumpWidget(host());
    await tester.pumpAndSettle();

    expect(find.textContaining('Annuaire non téléchargé'), findsOneWidget);
    // L'action de premier téléchargement est ancrée en bas d'écran, en zone de
    // pouce, et non plus en tête de bandeau.
    expect(find.text('Télécharger l\'annuaire'), findsOneWidget);
  });

  phase2TestWidgets('le téléchargement rend une progression, page par page', (
    WidgetTester tester,
  ) async {
    await db.delete(db.phase2Directory).go();
    api.directoryPages.addAll(<Phase2DirectoryPage>[
      directoryPage(
        entries: <Phase2DirectoryEntry>[
          directoryEntry(prospectId: 'a', phoneE164: '+221770000001'),
          directoryEntry(prospectId: 'b', phoneE164: '+221770000002'),
        ],
        nextCursor: 'c1',
        hasMore: true,
      ),
      directoryPage(
        entries: <Phase2DirectoryEntry>[
          directoryEntry(prospectId: 'c', phoneE164: '+221770000003'),
        ],
        nextCursor: 'c2',
      ),
    ]);

    await tester.pumpWidget(host());
    await tester.pumpAndSettle();
    await tester.tap(find.text('Télécharger l\'annuaire'));
    await tester.pumpAndSettle();

    expect(find.textContaining('3 numéros'), findsOneWidget);
    expect(await db.countPhase2Directory().getSingle(), 3);
  });

  // Une lecture de l'annuaire ou un téléchargement qui échoue hors du réseau ne
  // remontait nulle part : la future partait en arrière-plan sans personne pour
  // en traiter l'erreur. Sur le terrain il n'y a ni console ni rapport de
  // plantage, donc l'écran doit le dire lui-même.
  phase2TestWidgets('un annuaire illisible le dit au lieu de rester muet', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      host(
        directory: _BrokenDirectory(database: db, api: api),
      ),
    );
    await tester.pumpAndSettle();
    await type(tester, '771234567');

    expect(find.textContaining('Lecture de l\'annuaire impossible'), findsOneWidget);
  });

  phase2TestWidgets('un téléchargement qui casse rend la main au bouton', (
    WidgetTester tester,
  ) async {
    await db.delete(db.phase2Directory).go();
    await tester.pumpWidget(
      host(
        directory: _BrokenDirectory(database: db, api: api),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Télécharger l\'annuaire'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Téléchargement interrompu'), findsOneWidget);
    // Le compte-rendu compte moins que ceci : sans remise à zéro de l'état, le
    // bouton reste désactivé et l'annuaire ne peut plus jamais être téléchargé
    // sans redémarrer l'application.
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Télécharger l\'annuaire'),
          )
          .enabled,
      isTrue,
    );
  });

  // ═══ LA FEUILLE NE CITE PLUS AUCUNE ISSUE ═══
  //
  // C'est le point du lot : l'équipe du client ajoute ses motifs depuis le web,
  // et le parc les propose sans nouvelle version de l'application.

  Future<void> seedReason({
    required String code,
    required String label,
    String effect = CallEffects.keepOpen,
    bool requiresComment = false,
    int sortOrder = 100,
  }) {
    return db
        .into(db.callOutcomeReasons)
        .insert(
          CallOutcomeReasonsCompanion.insert(
            code: code,
            label: label,
            effect: effect,
            requiresComment: Value<bool>(requiresComment),
            sortOrder: Value<int>(sortOrder),
            minPayloadVersion: const Value<int>(2),
          ),
        );
  }

  // Deux motifs qui programment tous deux un rappel : le sélecteur d'heure n'est
  // pas démonté entre les deux, sa puce reste allumée, et l'heure était pourtant
  // remise à zéro. Le rappel enregistré était vide alors que l'écran affirmait
  // le contraire.
  phase2TestWidgets('changer de motif de rappel garde l\'heure déjà choisie', (
    WidgetTester tester,
  ) async {
    await seedReason(
      code: 'NRP',
      label: 'Ne répond pas',
      effect: CallEffects.scheduleCallback,
      sortOrder: 1,
    );
    await seedReason(
      code: 'OCCUPE',
      label: 'Occupé',
      effect: CallEffects.scheduleCallback,
      sortOrder: 2,
    );

    await tester.pumpWidget(host());
    await tester.pumpAndSettle();
    await type(tester, '771234567');
    await chooseOutcome(tester, 'Ne répond pas');

    await tester.ensureVisible(find.text('Demain 9 h'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Demain 9 h'));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Occupé'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Occupé'));
    await tester.pumpAndSettle();

    expect(
      tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Demain 9 h')).selected,
      isTrue,
    );

    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    final CallAttempt attempt = (await db.select(db.callAttempts).get()).single;
    expect(attempt.reasonCode, 'OCCUPE');
    expect(
      attempt.callbackAt,
      DateTime.utc(2026, 8, 13, 9),
      reason: 'la puce reste allumée : l\'heure enregistrée doit la suivre',
    );
  });

  phase2TestWidgets('la feuille rend les motifs du serveur, groupés par effet', (
    WidgetTester tester,
  ) async {
    await seedReason(code: 'NRP', label: 'Ne répond pas', sortOrder: 10);
    await seedReason(code: 'OCCUPE', label: 'Occupé', sortOrder: 20);
    await seedReason(
      code: 'RDV_PRIS',
      label: 'Rendez-vous pris',
      effect: CallEffects.scheduleCallback,
      sortOrder: 30,
    );

    await tester.pumpWidget(host());
    await tester.pumpAndSettle();
    await type(tester, '771234567');

    await tester.ensureVisible(find.text('Méthode non obtenue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Méthode non obtenue'));
    await tester.pumpAndSettle();

    expect(find.text('Ne répond pas'), findsOneWidget);
    expect(find.text('Occupé'), findsOneWidget);
    expect(find.text('Rendez-vous pris'), findsOneWidget);
    expect(find.text('Le dossier reste ouvert'), findsOneWidget);
    expect(find.text('Un rappel est à programmer'), findsOneWidget);
    // Les six motifs système ne sont plus servis : la table locale les remplace
    // en entier, sinon un motif retiré côté serveur resterait proposé à vie.
    expect(find.text('Injoignable'), findsNothing);
    expect(find.text('Autre'), findsNothing);
  });

  phase2TestWidgets('choisir un motif du serveur enregistre son code', (
    WidgetTester tester,
  ) async {
    await seedReason(code: 'NRP', label: 'Ne répond pas', sortOrder: 10);

    await tester.pumpWidget(host());
    await tester.pumpAndSettle();
    await type(tester, '771234567');
    await chooseOutcome(tester, 'Ne répond pas');

    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    expect(find.text('Ne répond pas'), findsOneWidget);
    final CallAttempt attempt = (await db.select(db.callAttempts).get()).single;
    expect(attempt.reasonCode, 'NRP');
    expect(attempt.effect, CallEffects.keepOpen);
    // L'issue reste celle de l'effet : `outcome` est l'énumération fermée que le
    // serveur sait encore lire.
    expect(attempt.outcome, CallOutcomes.unreachable);
  });

  phase2TestWidgets('un motif du serveur qui exige un commentaire le réclame', (
    WidgetTester tester,
  ) async {
    await seedReason(
      code: 'LITIGE',
      label: 'Litige en cours',
      requiresComment: true,
      sortOrder: 10,
    );

    await tester.pumpWidget(host());
    await tester.pumpAndSettle();
    await type(tester, '771234567');
    await chooseOutcome(tester, 'Litige en cours');

    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    expect(find.textContaining('commentaire est obligatoire'), findsOneWidget);
    expect(await db.countMyAttempts().getSingle(), 0);
  });
}

/// Un annuaire dont la base locale refuse aussi bien la lecture que l'écriture.
class _BrokenDirectory extends Phase2DirectorySync {
  _BrokenDirectory({required super.database, required super.api});

  @override
  Future<Phase2DirectoryData?> lookupByPhone(String phoneE164) =>
      Future<Phase2DirectoryData?>.error(StateError('base illisible'));

  @override
  Future<int> pull({
    int maxPages = 300,
    void Function(int applied, bool hasMore)? onProgress,
  }) => Future<int>.error(StateError('base illisible'));
}

/// Un commercial connecté, sans toucher au stockage sécurisé ni au réseau.
class _SignedInController extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    userId: 'commercial-test',
    fullName: 'Awa Sy',
  );
}
