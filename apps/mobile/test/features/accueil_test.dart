import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/connectivity.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:cpi_go/features/accueil/presentation/registre_screen.dart';
import 'package:cpi_go/features/accueil/presentation/visite_form_screen.dart';
import 'package:cpi_go/features/accueil/visites_repository.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Le registre des visites sur mobile, hors ligne d'abord.
///
/// Ce que ces tests interdisent de perdre : une inscription qui part au
/// serveur avant que le réseau soit revenu, un registre illisible sans
/// connexion, un bouton d'enregistrement qui reste grisé après une erreur, et
/// un numéro de téléphone reformaté en route.
void main() {
  final DateTime midi = DateTime.utc(2026, 8, 12, 9, 12);
  const String jour = '2026-08-12';

  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
  });

  tearDown(() async => db.close());

  VisiteReferentielDto liste(String id, String label) => VisiteReferentielDto(
    id: id,
    code: label.toUpperCase().replaceAll(' ', '_'),
    label: label,
    isActive: true,
    isSystem: true,
    sortOrder: 1,
    updatedAt: midi,
  );

  final VisiteReferentielsBundleDto listes = VisiteReferentielsBundleDto(
    entreprises: <VisiteReferentielDto>[liste('e1', 'CPI'), liste('e2', 'SANTARGILE')],
    directions: <VisiteReferentielDto>[liste('d1', 'COMMERCIALE')],
    destinataires: <VisiteReferentielDto>[liste('t1', 'MME. NDOYE')],
    objets: <VisiteReferentielDto>[
      liste('o1', 'ACHAT TERRAIN'),
      liste('o2', 'SUIVI DE DOSSIER'),
    ],
  );

  Widget host(
    Widget screen, {
    VisitesPort? port,
    WriteRepository? writes,
    bool horsLigne = false,
    String role = 'ACCUEIL',
  }) {
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        if (port != null) visitesPortProvider.overrideWithValue(port),
        if (writes != null) writeRepositoryProvider.overrideWithValue(writes),
        clockProvider.overrideWithValue(FakeClock(midi)),
        connectivitySourceProvider.overrideWithValue(
          _FakeSource(
            horsLigne ? ConnectivityResult.none : ConnectivityResult.wifi,
          ),
        ),
        networkValidationProvider.overrideWithValue(const _FakeValidation(true)),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        authControllerProvider.overrideWith(() => _SignedIn(role)),
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

  Future<void> teardownTree(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  group('registre du jour', () {
    testWidgets('les visites déjà en base sont listées, pour le jour courant', (
      WidgetTester tester,
    ) async {
      await insertVisite(
        db,
        id: 'v1',
        date: jour,
        time: '09:12',
        visitorName: 'Awa Ndiaye',
      );
      await tester.pumpWidget(host(const RegistreScreen(), port: _FakePort(listes)));
      await tester.pumpAndSettle();

      expect(find.text('Awa Ndiaye'), findsOneWidget);
      expect(find.text('09:12'), findsOneWidget);
      expect(find.text('V-2026-000412'), findsOneWidget);
      expect(find.text('1 visite aujourd\'hui'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('un registre vide dit quoi faire ensuite', (WidgetTester tester) async {
      await tester.pumpWidget(host(const RegistreScreen(), port: _FakePort(listes)));
      await tester.pumpAndSettle();

      expect(find.text('Aucune visite inscrite aujourd\'hui'), findsOneWidget);
      expect(
        find.text('Inscrivez le premier visiteur avec le bouton du bas.'),
        findsOneWidget,
      );

      await teardownTree(tester);
    });

    testWidgets('une visite sans référence attend son passage au serveur', (
      WidgetTester tester,
    ) async {
      await insertVisite(
        db,
        id: 'v1',
        reference: null,
        date: jour,
        time: '09:12',
        visitorName: 'Awa Ndiaye',
      );
      await tester.pumpWidget(host(const RegistreScreen(), port: _FakePort(listes)));
      await tester.pumpAndSettle();

      expect(find.text('Awa Ndiaye'), findsOneWidget);
      expect(find.text('En attente d\'envoi'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('hors ligne, le registre du jour reste lisible', (
      WidgetTester tester,
    ) async {
      await insertVisite(
        db,
        id: 'v1',
        date: jour,
        time: '09:12',
        visitorName: 'Awa Ndiaye',
      );
      await tester.pumpWidget(
        host(const RegistreScreen(), port: _FakePort(listes), horsLigne: true),
      );
      // Pas de pumpAndSettle : le pouls de l'indicateur hors ligne tourne en
      // continu et ne se stabilise jamais.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('Awa Ndiaye'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('un compte sans le registre est renvoyé vers la direction', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        host(const RegistreScreen(), port: _FakePort(listes), role: 'COMMERCIAL'),
      );
      await tester.pumpAndSettle();

      expect(
        find.textContaining('Ce compte ne tient pas le registre des visites.'),
        findsOneWidget,
      );

      await teardownTree(tester);
    });
  });

  group('inscription d\'un visiteur', () {
    // La colonne du formulaire est plus haute que l'écran de test : un champ
    // jamais amené à l'image n'est pas construit, et `enterText` ne le voit pas.
    Future<void> amener(WidgetTester tester, String champ) async {
      await tester.scrollUntilVisible(
        find.byKey(ValueKey<String>(champ)),
        120,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
    }

    Future<void> saisir(WidgetTester tester, String champ, String texte) async {
      await amener(tester, champ);
      await tester.enterText(find.byKey(ValueKey<String>(champ)), texte);
      await tester.pumpAndSettle();
    }

    Future<void> choisir(WidgetTester tester, String champ, String libelle) async {
      await amener(tester, champ);
      await tester.tap(find.byKey(ValueKey<String>(champ)));
      await tester.pumpAndSettle();
      await tester.tap(find.text(libelle).last);
      await tester.pumpAndSettle();
    }

    Future<void> remonter(WidgetTester tester) async {
      await tester.drag(find.byType(Scrollable).first, const Offset(0, 1200));
      await tester.pumpAndSettle();
    }

    testWidgets('les trois champs obligatoires sont réclamés avant tout envoi', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen(), port: _FakePort(listes)));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey<String>('visite-enregistrer')));
      await tester.pumpAndSettle();

      expect(find.text('À renseigner.'), findsOneWidget);
      expect(find.text('À choisir dans la liste.'), findsNWidgets(2));
      expect(await db.select(db.visites).get(), isEmpty);

      // Les deux listes renseignées, le nom toujours vide : c'est le seul
      // moment où l'absence de nom est ce qui retient la visite.
      await choisir(tester, 'champ-entreprise', 'CPI');
      await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
      await tester.tap(find.byKey(const ValueKey<String>('visite-enregistrer')));
      await tester.pumpAndSettle();

      expect(await db.select(db.visites).get(), isEmpty);
      expect(find.text('À renseigner.'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets(
      'la visite part hors ligne, avec le jour, l\'heure et le numéro tel quel',
      (WidgetTester tester) async {
        await tester.pumpWidget(
          host(const VisiteFormScreen(), port: _FakePort(listes)),
        );
        await tester.pumpAndSettle();

        await saisir(tester, 'visite-nom', '  Awa Ndiaye  ');
        await choisir(tester, 'champ-entreprise', 'CPI');
        await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
        // Un numéro étranger : la normalisation sénégalaise le refuserait, le
        // registre le garde.
        await saisir(tester, 'visite-telephone', '+33 6 12 34 56 78');
        await tester.tap(find.byKey(const ValueKey<String>('visite-enregistrer')));
        await tester.pumpAndSettle();
        await remonter(tester);

        final List<Visite> lignes = await db.select(db.visites).get();
        expect(lignes, hasLength(1));
        final Visite ligne = lignes.single;
        expect(ligne.date, jour);
        expect(ligne.time, '09:12');
        expect(ligne.visitorName, 'Awa Ndiaye');
        expect(ligne.phone, '+33 6 12 34 56 78');
        expect(ligne.entrepriseId, 'e1');
        expect(ligne.objetId, 'o1');
        expect(ligne.directionId, isNull);
        expect(ligne.destinataireId, isNull);
        expect(ligne.comment, isNull);
        expect(ligne.reference, isNull);

        final List<OutboxData> file = await db.select(db.outbox).get();
        expect(file, hasLength(1));
        expect(file.single.entityType, 'visite');
        expect(file.single.op, 'create');
        final Map<String, Object?> payload =
            jsonDecode(file.single.payload) as Map<String, Object?>;
        expect(payload['visitorName'], 'Awa Ndiaye');
        expect(payload['visitDate'], jour);
        expect(payload['visitTime'], '09:12');
        expect(payload['phone'], '+33 6 12 34 56 78');
        expect(payload['entrepriseId'], 'e1');
        expect(payload['objetId'], 'o1');
        expect(payload.containsKey('directionId'), isFalse);
        expect(payload.containsKey('destinataireId'), isFalse);

        expect(find.textContaining('inscrit(e) au registre'), findsOneWidget);
        // Le comptoir enchaîne : le nom repart vide, l'entreprise reste.
        expect(
          tester.widget<TextField>(find.byKey(const ValueKey<String>('visite-nom')))
              .controller
              ?.text,
          '',
        );
        expect(find.text('CPI'), findsOneWidget);

        await teardownTree(tester);
      },
    );

    testWidgets('une inscription hors ligne part quand même en file', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        host(const VisiteFormScreen(), port: _FakePort(listes), horsLigne: true),
      );
      await tester.pumpAndSettle();

      await saisir(tester, 'visite-nom', 'Awa Ndiaye');
      await choisir(tester, 'champ-entreprise', 'CPI');
      await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
      await tester.tap(find.byKey(const ValueKey<String>('visite-enregistrer')));
      await tester.pumpAndSettle();

      expect(await db.select(db.visites).get(), hasLength(1));
      expect(await db.select(db.outbox).get(), hasLength(1));
      expect(find.textContaining('inscrit(e) au registre'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('une direction choisie puis retirée ne part pas en file', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen(), port: _FakePort(listes)));
      await tester.pumpAndSettle();

      await saisir(tester, 'visite-nom', 'Awa Ndiaye');
      await choisir(tester, 'champ-entreprise', 'CPI');
      await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
      await choisir(tester, 'champ-direction', 'COMMERCIALE');
      await choisir(tester, 'champ-direction', 'Aucun');
      await tester.tap(find.byKey(const ValueKey<String>('visite-enregistrer')));
      await tester.pumpAndSettle();

      expect((await db.select(db.visites).get()).single.directionId, isNull);

      await teardownTree(tester);
    });

    testWidgets('le choix de l\'heure s\'ouvre et laisse l\'heure intacte s\'il est annulé', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen(), port: _FakePort(listes)));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(TextButton, 'Changer'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Annuler'));
      await tester.pumpAndSettle();

      expect(find.text('Aujourd\'hui, 09:12'), findsOneWidget);

      await saisir(tester, 'visite-nom', 'Awa Ndiaye');
      await choisir(tester, 'champ-entreprise', 'CPI');
      await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
      await tester.tap(find.byKey(const ValueKey<String>('visite-enregistrer')));
      await tester.pumpAndSettle();

      expect((await db.select(db.visites).get()).single.time, '09:12');

      await teardownTree(tester);
    });

    testWidgets('un échec d\'écriture s\'affiche et rend le bouton', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        host(
          const VisiteFormScreen(),
          port: _FakePort(listes),
          writes: _BrokenWrites(db),
        ),
      );
      await tester.pumpAndSettle();

      await saisir(tester, 'visite-nom', 'Awa Ndiaye');
      await choisir(tester, 'champ-entreprise', 'CPI');
      await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
      await tester.tap(find.byKey(const ValueKey<String>('visite-enregistrer')));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('La visite n\'a pas été enregistrée.'),
        findsOneWidget,
      );
      expect(find.textContaining('base en lecture seule'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(
              find.byKey(const ValueKey<String>('visite-enregistrer')),
            )
            .onPressed,
        isNotNull,
      );

      await teardownTree(tester);
    });

    testWidgets('deux appuis sur une écriture lente n\'inscrivent qu\'une visite', (
      WidgetTester tester,
    ) async {
      final Completer<String> lent = Completer<String>();
      await tester.pumpWidget(
        host(
          const VisiteFormScreen(),
          port: _FakePort(listes),
          writes: _LenteEcriture(db, lent),
        ),
      );
      await tester.pumpAndSettle();

      await saisir(tester, 'visite-nom', 'Awa Ndiaye');
      await choisir(tester, 'champ-entreprise', 'CPI');
      await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');

      // Deux appuis dans la MÊME image : l'arbre n'a pas encore été reconstruit,
      // le bouton est donc toujours actif au second. Sans la garde d'entrée,
      // deux visites partent.
      await tester.tap(find.byKey(const ValueKey<String>('visite-enregistrer')));
      await tester.tap(find.byKey(const ValueKey<String>('visite-enregistrer')));
      await tester.pump();

      lent.complete('v-neuve');
      await tester.pumpAndSettle();

      expect(await db.select(db.visites).get(), hasLength(1));

      await teardownTree(tester);
    });

    testWidgets('des listes illisibles bloquent l\'envoi en le disant', (
      WidgetTester tester,
    ) async {
      final _FakePort port = _FakePort(
        listes,
        echecListes: const ApiException(
          'NETWORK',
          message: 'Réseau indisponible.',
          kind: FailureKind.unreachable,
        ),
      );
      await tester.pumpWidget(host(const VisiteFormScreen(), port: port));
      await tester.pumpAndSettle();

      expect(find.textContaining('Les listes de l\'accueil manquent.'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(
              find.byKey(const ValueKey<String>('visite-enregistrer')),
            )
            .onPressed,
        isNull,
      );

      port.echecListes = null;
      await tester.tap(find.widgetWithText(OutlinedButton, 'Réessayer'));
      await tester.pumpAndSettle();

      expect(
        tester
            .widget<FilledButton>(
              find.byKey(const ValueKey<String>('visite-enregistrer')),
            )
            .onPressed,
        isNotNull,
      );

      await teardownTree(tester);
    });
  });

  group('accès au registre', () {
    test('les trois rôles du registre, et personne d\'autre', () {
      expect(peutTenirLeRegistre('ACCUEIL'), isTrue);
      expect(peutTenirLeRegistre('DIRECTION'), isTrue);
      expect(peutTenirLeRegistre('ADMIN'), isTrue);
      expect(peutTenirLeRegistre('SUPERVISEUR'), isFalse);
      expect(peutTenirLeRegistre('COMMERCIAL'), isFalse);
      expect(peutTenirLeRegistre(null), isFalse);
    });
  });
}

class _FakePort implements VisitesPort {
  _FakePort(this.listes, {this.echecListes});

  final VisiteReferentielsBundleDto listes;
  Object? echecListes;

  @override
  Future<VisiteReferentielsBundleDto> referentiels() async {
    final Object? echec = echecListes;
    if (echec != null) throw echec;
    return listes;
  }
}

/// Une base qui refuse l'inscription.
class _BrokenWrites extends WriteRepository {
  _BrokenWrites(super.db);

  @override
  Future<String> inscrireVisite({
    required String visitorName,
    required String date,
    required String entrepriseId,
    required String entrepriseLabel,
    required String objetId,
    required String objetLabel,
    required String createdById,
    String? time,
    String? phone,
    String? directionId,
    String? directionLabel,
    String? destinataireId,
    String? destinataireLabel,
    String? comment,
    String? id,
  }) => Future<String>.error(StateError('base en lecture seule'));
}

/// Une inscription dont l'écriture locale ne se termine qu'à la demande du test.
class _LenteEcriture extends WriteRepository {
  _LenteEcriture(super.db, this._gate);

  final Completer<String> _gate;

  @override
  Future<String> inscrireVisite({
    required String visitorName,
    required String date,
    required String entrepriseId,
    required String entrepriseLabel,
    required String objetId,
    required String objetLabel,
    required String createdById,
    String? time,
    String? phone,
    String? directionId,
    String? directionLabel,
    String? destinataireId,
    String? destinataireLabel,
    String? comment,
    String? id,
  }) async {
    final String entityId = await _gate.future;
    return super.inscrireVisite(
      visitorName: visitorName,
      date: date,
      entrepriseId: entrepriseId,
      entrepriseLabel: entrepriseLabel,
      objetId: objetId,
      objetLabel: objetLabel,
      createdById: createdById,
      time: time,
      phone: phone,
      directionId: directionId,
      directionLabel: directionLabel,
      destinataireId: destinataireId,
      destinataireLabel: destinataireLabel,
      comment: comment,
      id: entityId,
    );
  }
}

class _FakeSource implements ConnectivitySource {
  const _FakeSource(this._result);

  final ConnectivityResult _result;

  @override
  Future<List<ConnectivityResult>> current() async => <ConnectivityResult>[_result];

  @override
  Stream<List<ConnectivityResult>> changes() =>
      const Stream<List<ConnectivityResult>>.empty();
}

class _FakeValidation implements NetworkValidation {
  const _FakeValidation(this._verdict);

  final bool? _verdict;

  @override
  Future<bool?> isValidated() async => _verdict;
}

class _SignedIn extends AuthController {
  _SignedIn(this._role);

  final String _role;

  @override
  AuthState build() => AuthState(
    status: AuthStatus.authenticated,
    userId: 'u-1',
    fullName: 'Fatou Sarr',
    role: _role,
    email: 'fatou.sarr@cpi.sn',
  );
}

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}
