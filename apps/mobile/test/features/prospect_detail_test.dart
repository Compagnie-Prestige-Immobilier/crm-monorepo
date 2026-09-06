import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/app_router.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/prospect/presentation/prospect_detail_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_detail_screen.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// La fiche d'un prospect est le seul endroit où le téléconseiller lit ce qu'il
/// a saisi, appelle la personne et défait une erreur.
///
/// Avant elle, la ligne de la liste Grand Public n'ouvrait qu'une feuille dont
/// la seule action était « Supprimer » : ouvrir une fiche ne montrait donc
/// jamais la fiche. Ces tests verrouillent les trois choses qui manquaient : les
/// faits saisis, le bouton d'appel, et une suppression qui passe par une
/// confirmation nommée.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
    SinglePush.reset();

    await db
        .into(db.prospects)
        .insert(
          ProspectsCompanion.insert(
            id: 'gp-1',
            nom: 'Ndiaye',
            prenom: 'Fatou',
            phoneE164: '+221771234567',
            banqueId: const Value<String?>('bq-1'),
            syndicatId: const Value<String?>('sy-1'),
            projet: const Value<String>('GRAND_PUBLIC'),
            type: const Value<String?>('FONCTIONNAIRE'),
            profession: const Value<String?>('Institutrice'),
            canalProvenanceId: const Value<String?>('cn-1'),
            incomeBandId: const Value<String?>('rev-1'),
            dureeSystemeMois: const Value<int?>(36),
            createdById: 'u-1',
            clientCreatedAt: t0,
            localUpdatedAt: t0,
          ),
        );
    await db
        .into(db.prospectJourneys)
        .insert(
          ProspectJourneysCompanion.insert(
            prospectId: 'gp-1',
            projet: 'GRAND_PUBLIC',
          ),
        );

    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Mamadou Diallo',
    );
    await insertProspect(
      db,
      id: 'ch-1',
      representantId: 'rep-1',
      phone: '+221780000002',
      prenom: 'Awa',
      nom: 'Fall',
    );
  });

  tearDown(() => db.close());

  Future<GoRouter> open(WidgetTester tester, String prospectId) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    late GoRouter router;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(api),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
          authControllerProvider.overrideWith(_SignedInController.new),
        ],
        child: Consumer(
          builder: (BuildContext context, WidgetRef ref, Widget? child) {
            router = ref.watch(routerProvider);
            return MaterialApp.router(
              theme: AppTheme.light,
              locale: const Locale('fr'),
              localizationsDelegates: GlobalMaterialLocalizations.delegates,
              supportedLocales: const <Locale>[Locale('fr')],
              routerConfig: router,
            );
          },
        ),
      ),
    );
    await settle(tester);
    router.push<void>(Routes.prospectDetailFor(prospectId)).ignore();
    await settle(tester);
    return router;
  }

  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  testWidgets('la fiche montre de quoi appeler, et rien de plus', (
    WidgetTester tester,
  ) async {
    await open(tester, 'gp-1');

    expect(find.byType(ProspectDetailScreen), findsOneWidget);
    expect(find.text('Fatou Ndiaye'), findsOneWidget);
    expect(find.text('+221 77 123 45 67'), findsOneWidget);
    expect(find.text('Pas encore envoyé'), findsOneWidget);

    // Le dossier commercial se remplit au téléphone, il ne se lit pas ici : ces
    // lignes n'aidaient à aucun appel.
    for (final String bruit in <String>[
      'Secteur',
      'Banque',
      'Syndicat',
      'Date de saisie',
    ]) {
      expect(find.text(bruit), findsNothing, reason: '« $bruit » est de trop');
    }

    // Grand Public : personne ne l'a présentée, la ligne n'a pas lieu d'être.
    expect(find.text('Représentant'), findsNothing);

    await unmount(tester);
  });

  // Ce que la SITUATION a fait renseigner se lit : sans lui, le téléconseiller
  // rappelle un fonctionnaire sans savoir de quel ministère il vient. Un champ
  // vide, en revanche, ne se dit pas : la fiche montre ce qu'on sait.
  testWidgets('la fiche montre les renseignements de situation', (
    WidgetTester tester,
  ) async {
    await open(tester, 'gp-1');

    expect(find.text('Situation'), findsOneWidget);
    expect(find.text('Fonctionnaire'), findsOneWidget);
    expect(find.text('Profession'), findsOneWidget);
    expect(find.text('Institutrice'), findsOneWidget);
    expect(find.text('Tranche de revenus'), findsOneWidget);
    expect(find.text('Revenu Test'), findsOneWidget);
    expect(find.text('Durée de remboursement'), findsOneWidget);
    expect(find.text('36 mois'), findsOneWidget);
    expect(find.text('Canal de provenance'), findsOneWidget);
    expect(find.text('Parrainage'), findsOneWidget);
    for (final String vide in <String>[
      'Ancienneté',
      'Type de contrat',
      'Pays de résidence',
      'WhatsApp',
    ]) {
      expect(find.text(vide), findsNothing, reason: '« $vide » est vide');
    }

    await unmount(tester);
  });

  // La fiche porte un IDENTIFIANT de profession : afficher l'identifiant brut
  // ne dirait rien à personne, c'est le libellé du référentiel qui se lit.
  testWidgets('la profession du référentiel se lit par son libellé', (
    WidgetTester tester,
  ) async {
    await (db.update(
      db.prospects,
    )..where((Prospects t) => t.id.equals('gp-1'))).write(
      const ProspectsCompanion(
        profession: Value<String?>(null),
        professionId: Value<String?>('pro-ens'),
      ),
    );

    await open(tester, 'gp-1');

    expect(find.text('Profession'), findsOneWidget);
    expect(find.text('Instituteur Test'), findsOneWidget);
    expect(find.text('pro-ens'), findsNothing);

    await unmount(tester);
  });

  testWidgets('la fiche appelle et consigne, elle ne supprime pas', (
    WidgetTester tester,
  ) async {
    await open(tester, 'gp-1');

    expect(find.text('Appeler'), findsOneWidget);
    expect(find.text('Consigner l\'appel'), findsOneWidget);
    // La base vient du bureau : rien ne s'efface depuis le téléphone.
    expect(find.text('Supprimer ce prospect'), findsNothing);

    await unmount(tester);
  });

  // Ce que le TÉLÉPHONE a fait de l'appel, sous le numéro : sans cette ligne,
  // la fiche laisse croire qu'un appel lancé a forcément abouti.
  testWidgets('la fiche montre ce que le journal du téléphone a confirmé', (
    WidgetTester tester,
  ) async {
    await db
        .into(db.preuvesAppel)
        .insert(
          PreuvesAppelCompanion.insert(
            id: 'preuve-1',
            kind: 'prospect',
            entityId: 'gp-1',
            phoneE164: '+221771234567',
            lanceAt: t0,
            mode: 'call',
            journalType: const Value<String?>('sortant'),
            journalDureeS: const Value<int?>(92),
            journalAt: Value<DateTime?>(DateTime(2026, 8, 12, 14, 2)),
            rapprocheAt: Value<DateTime?>(t0),
          ),
        );

    await open(tester, 'gp-1');

    expect(find.text('Sortant · 1 min 32 · 14:02'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('un appel lancé sans confirmation du téléphone le dit', (
    WidgetTester tester,
  ) async {
    await db
        .into(db.preuvesAppel)
        .insert(
          PreuvesAppelCompanion.insert(
            id: 'preuve-1',
            kind: 'prospect',
            entityId: 'gp-1',
            phoneE164: '+221771234567',
            lanceAt: t0,
            mode: 'dial',
          ),
        );

    await open(tester, 'gp-1');

    expect(find.text('Non confirmé par le téléphone'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('le dernier appel et le rappel promis se lisent sur la fiche', (
    WidgetTester tester,
  ) async {
    await db
        .into(db.phase2Directory)
        .insert(
          Phase2DirectoryData(
            prospectId: 'gp-1',
            phoneE164: '+221771234567',
            phase2Status: 'METHOD_OBTAINED',
            enrollmentMethod: 'PLATFORM',
            rev: 1,
            updatedAt: t0,
          ),
        );
    await open(tester, 'gp-1');

    expect(find.text('Dernier appel'), findsOneWidget);
    expect(find.text('Méthode obtenue'), findsOneWidget);
    expect(find.text('Méthode d\'enrôlement'), findsOneWidget);
    expect(find.text('Plateforme en ligne'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('la fiche d\'un prospect CHUES mène à son représentant', (
    WidgetTester tester,
  ) async {
    await open(tester, 'ch-1');

    expect(find.text('Représentant'), findsOneWidget);
    expect(find.text('Mamadou Diallo'), findsOneWidget);

    await tester.tap(find.text('Représentant'));
    await settle(tester);

    expect(find.byType(RepresentantDetailScreen), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('une fiche supprimée ailleurs le dit et laisse une issue', (
    WidgetTester tester,
  ) async {
    await open(tester, 'inconnu');

    expect(find.text('Cette fiche n\'est plus ici'), findsOneWidget);
    expect(find.text('Revenir aux projets'), findsOneWidget);

    await unmount(tester);
  });
}

Future<void> settle(WidgetTester tester) async {
  for (int i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 60));
  }
}

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}

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
