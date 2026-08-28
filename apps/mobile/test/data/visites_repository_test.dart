import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/visites_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';

/// Le registre de l'accueil, lu en local : une seule requête sert le jour,
/// la semaine, le mois, tout, et la recherche.
void main() {
  late AppDatabase db;
  late VisitesRepository repo;

  final DateTime maintenant = DateTime.utc(2026, 8, 12, 9, 12);

  setUp(() async {
    db = await openTestDatabase();
    repo = VisitesRepository(db);
  });

  tearDown(() => db.close());

  test('la période « jour » ne rend que les visites du jour courant', () async {
    await insertVisite(db, id: 'v1', date: '2026-08-12', visitorName: 'Awa');
    await insertVisite(db, id: 'v2', date: '2026-08-11', visitorName: 'Fatou');

    final VisitesPage page = await repo
        .watch(periode: PeriodeRegistre.jour, maintenant: maintenant)
        .first;

    expect(page.items.map((VisiteAvecStatut v) => v.visitorName), <String>[
      'Awa',
    ]);
    expect(page.truncated, isFalse);
  });

  test('la recherche porte sur le nom, l\'entreprise, l\'étage, la référence '
      'et les deux colonnes de téléphone', () async {
    await insertVisite(
      db,
      id: 'v1',
      date: '2026-08-12',
      visitorName: 'Awa Ndiaye',
      entrepriseLabel: 'CPI',
      directionId: 'd1',
      directionLabel: 'MARKETING',
      reference: 'V-2026-000001',
    );
    await insertVisite(
      db,
      id: 'v2',
      date: '2026-08-12',
      visitorName: 'Moussa Fall',
      entrepriseLabel: 'SANTARGILE',
      reference: 'V-2026-000002',
      phone: '77 000 00 02',
      phoneE164: '+221770000002',
    );

    Future<List<String>> noms(String q) async {
      final VisitesPage page = await repo
          .watch(
            search: q,
            periode: PeriodeRegistre.tout,
            maintenant: maintenant,
          )
          .first;
      return page.items.map((VisiteAvecStatut v) => v.visitorName).toList();
    }

    expect(await noms('moussa'), <String>['Moussa Fall']);
    expect(await noms('santargile'), <String>['Moussa Fall']);
    expect(await noms('v-2026-000002'), <String>['Moussa Fall']);
    expect(await noms('770000002'), <String>['Moussa Fall']);
    expect(await noms('77 000 00 02'), <String>['Moussa Fall']);
    expect(await noms('awa'), <String>['Awa Ndiaye']);
    expect(await noms('marketing'), <String>['Awa Ndiaye']);
  });

  test(
    'le statut d\'envoi vient de l\'outbox, pas de la seule référence',
    () async {
      await insertVisite(
        db,
        id: 'v-ok',
        date: '2026-08-12',
        visitorName: 'Envoyée',
      );
      await insertVisite(
        db,
        id: 'v-echec',
        date: '2026-08-12',
        reference: null,
        visitorName: 'En échec',
      );
      await queueOp(
        db,
        id: 'op-1',
        entityType: 'visite',
        entityId: 'v-echec',
        status: 'failed',
      );

      final VisitesPage page = await repo
          .watch(periode: PeriodeRegistre.jour, maintenant: maintenant)
          .first;
      final Map<String, VisiteAvecStatut> parNom = <String, VisiteAvecStatut>{
        for (final VisiteAvecStatut v in page.items) v.visitorName: v,
      };

      expect(parNom['Envoyée']!.syncStatus.name, 'synced');
      expect(parNom['En échec']!.syncStatus.name, 'failed');
    },
  );

  test('au-delà de 300 lignes, la page se borne et le dit', () async {
    for (int i = 0; i < 305; i++) {
      await insertVisite(
        db,
        id: 'v-$i',
        date: '2026-08-12',
        time: '${(i % 24).toString().padLeft(2, '0')}:00',
        visitorName: 'Visiteur $i',
      );
    }

    final VisitesPage page = await repo
        .watch(periode: PeriodeRegistre.jour, maintenant: maintenant)
        .first;

    expect(page.items, hasLength(300));
    expect(page.truncated, isTrue);
  });

  test(
    'les compteurs distinguent le jour, les 7 jours et l\'attente',
    () async {
      await insertVisite(db, id: 'v-jour', date: '2026-08-12');
      await insertVisite(db, id: 'v-semaine', date: '2026-08-08');
      await insertVisite(db, id: 'v-hors', date: '2026-07-01');
      await insertVisite(
        db,
        id: 'v-attente',
        date: '2026-08-12',
        reference: null,
      );
      await queueOp(
        db,
        id: 'op-1',
        entityType: 'visite',
        entityId: 'v-attente',
      );

      final CompteursAccueil c = await repo.watchCompteurs(maintenant).first;

      expect(c.jour, 2);
      expect(c.septJours, 3);
      expect(c.enAttente, 1);
    },
  );

  test('le top des entreprises et des objets se borne à cinq chacun', () async {
    for (int i = 0; i < 7; i++) {
      await insertVisite(
        db,
        id: 'v-$i',
        date: '2026-08-12',
        entrepriseId: 'e$i',
        entrepriseLabel: 'Entreprise $i',
        objetId: 'o$i',
        objetLabel: 'Objet $i',
      );
    }

    final TopLabels top = await repo.watchTopLabels(maintenant).first;

    expect(top.entreprises, hasLength(5));
    expect(top.objets, hasLength(5));
  });

  test('les personnes demandées se comptent aussi, sur la fenêtre '
      'demandée', () async {
    await insertVisite(
      db,
      id: 'v1',
      date: '2026-08-12',
      destinataireId: 't1',
      destinataireLabel: 'MME. NDOYE',
    );
    await insertVisite(
      db,
      id: 'v2',
      date: '2026-08-12',
      destinataireId: 't1',
      destinataireLabel: 'MME. NDOYE',
    );
    await insertVisite(
      db,
      id: 'v3',
      date: '2026-08-01',
      destinataireId: 't2',
      destinataireLabel: 'M. DIOP',
    );
    // Sans personne demandée : ne compte pour personne.
    await insertVisite(db, id: 'v4', date: '2026-08-12');

    final TopLabels mois = await repo.watchTopLabels(maintenant).first;
    expect(
      mois.destinataires.map((LabelCompte l) => (l.libelle, l.total)),
      <(String, int)>[('MME. NDOYE', 2), ('M. DIOP', 1)],
    );

    final TopLabels jour = await repo
        .watchTopLabels(maintenant, jours: 1)
        .first;
    expect(jour.destinataires.map((LabelCompte l) => l.libelle), <String>[
      'MME. NDOYE',
    ]);
  });

  group('rappel visiteur', () {
    test('la dernière visite d\'un homonyme, sur 90 jours', () async {
      await insertVisite(
        db,
        id: 'v-vieille',
        date: '2026-06-01',
        visitorName: 'Awa Ndiaye',
        objetLabel: 'Achat terrain',
      );
      await insertVisite(
        db,
        id: 'v-recente',
        date: '2026-08-01',
        time: '11:00',
        visitorName: 'Awa Ndiaye',
        objetLabel: 'Suivi de dossier',
        destinataireId: 't1',
        destinataireLabel: 'MME. NDOYE',
      );
      await insertVisite(
        db,
        id: 'v-autre',
        date: '2026-08-10',
        visitorName: 'Moussa Fall',
      );

      // Le rapprochement se fait sur le DÉBUT du nom : trois lettres suffisent.
      final VisiteAvecStatut? trouvee = await repo.dernierePourNom(
        'awa',
        maintenant: maintenant,
      );
      expect(trouvee?.id, 'v-recente');
      expect(trouvee?.destinataireLabel, 'MME. NDOYE');
      expect(trouvee?.objetLabel, 'Suivi de dossier');
    });

    test('rien au-delà de la fenêtre, rien sur un autre nom', () async {
      await insertVisite(
        db,
        id: 'v-trop-vieille',
        date: '2026-01-01',
        visitorName: 'Awa Ndiaye',
      );

      expect(await repo.dernierePourNom('awa', maintenant: maintenant), isNull);
      expect(
        await repo.dernierePourNom('ndiaye', maintenant: maintenant),
        isNull,
      );
      expect(await repo.dernierePourNom('  ', maintenant: maintenant), isNull);
    });
  });

  test('l\'heure de pointe est celle qui a vu le plus de visiteurs', () async {
    await insertVisite(db, id: 'v1', date: '2026-08-12', time: '10:05');
    await insertVisite(db, id: 'v2', date: '2026-08-12', time: '10:40');
    await insertVisite(db, id: 'v3', date: '2026-08-12', time: '14:00');

    final HeureDePointe? pointe = await repo
        .watchHeureDePointe(maintenant)
        .first;

    expect(pointe?.heure, 10);
    expect(pointe?.total, 2);
  });
}
