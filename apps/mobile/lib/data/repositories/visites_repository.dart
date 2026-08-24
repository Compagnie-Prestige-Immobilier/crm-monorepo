import 'package:drift/drift.dart';
import 'package:flutter/material.dart' show DateUtils, immutable;

import '../../core/utils/dakar_time.dart';
import '../../ui/widgets/activity_chart.dart' show ActivityDay;
import '../../ui/widgets/sync_status_icon.dart';
import '../local/database.dart';

@immutable
class VisiteAvecStatut {
  const VisiteAvecStatut({
    required this.id,
    required this.reference,
    required this.date,
    required this.time,
    required this.visitorName,
    required this.phone,
    required this.entrepriseLabel,
    required this.objetLabel,
    required this.directionLabel,
    required this.destinataireLabel,
    required this.comment,
    required this.syncStatus,
  });

  final String id;
  final String? reference;
  final String date;
  final String? time;
  final String visitorName;
  final String? phone;
  final String entrepriseLabel;
  final String objetLabel;
  final String? directionLabel;
  final String? destinataireLabel;
  final String? comment;
  final SyncStatus syncStatus;

  static VisiteAvecStatut fromRow(QueryRow row) => VisiteAvecStatut(
    id: row.read<String>('id'),
    reference: row.read<String?>('reference'),
    date: row.read<String>('date'),
    time: row.read<String?>('time'),
    visitorName: row.read<String>('visitor_name'),
    phone: row.read<String?>('phone'),
    entrepriseLabel: row.read<String>('entreprise_label'),
    objetLabel: row.read<String>('objet_label'),
    directionLabel: row.read<String?>('direction_label'),
    destinataireLabel: row.read<String?>('destinataire_label'),
    comment: row.read<String?>('comment'),
    syncStatus: SyncStatus.parse(row.read<String>('sync_status')),
  );
}

@immutable
class VisitesPage {
  const VisitesPage({required this.items, required this.truncated});

  final List<VisiteAvecStatut> items;

  /// La coupure existe pour borner le rendu, pas pour cacher des lignes ;
  /// l'écran la signale quand elle vaut `true`.
  final bool truncated;
}

enum PeriodeRegistre { jour, semaine, mois, tout }

@immutable
class LabelCompte {
  const LabelCompte({required this.libelle, required this.total});

  final String libelle;
  final int total;
}

@immutable
class TopLabels {
  const TopLabels({required this.entreprises, required this.objets});

  final List<LabelCompte> entreprises;
  final List<LabelCompte> objets;

  static const TopLabels vide = TopLabels(entreprises: [], objets: []);
}

@immutable
class HeureDePointe {
  const HeureDePointe({required this.heure, required this.total});

  final int heure;
  final int total;
}

@immutable
class CompteursAccueil {
  const CompteursAccueil({
    required this.jour,
    required this.septJours,
    required this.enAttente,
  });

  final int jour;
  final int septJours;
  final int enAttente;
}

class VisitesRepository {
  VisitesRepository(this._db);

  final AppDatabase _db;

  /// Un cran au-dessus de ce qu'un registre porte en pratique : la coupure
  /// existe pour borner le rendu, pas pour cacher des lignes. L'écran la
  /// signale.
  static const int registreRowCap = 300;

  static const String _statutJoin = '''
LEFT JOIN outbox AS o
    ON o.entity_type = 'visite'
   AND o.entity_id = v.id
   AND o.status IN ('pending', 'syncing', 'conflict', 'failed')
   AND o.seq = (
       SELECT MIN(o2.seq) FROM outbox AS o2
       WHERE o2.entity_type = 'visite' AND o2.entity_id = v.id
         AND o2.status IN ('pending', 'syncing', 'conflict', 'failed')
   )
''';

  /// `reference` est NULL tant que le serveur n'a pas attribué son numéro :
  /// c'est ce vide, et pas seulement l'outbox, qui dit « pas encore parti »
  /// pour une ligne dont l'opération de poussée aurait déjà disparu de la file.
  static const String _statutExpr =
      "CASE WHEN o.status IS NOT NULL THEN o.status "
      "WHEN v.reference IS NULL THEN 'pending' ELSE 'synced' END";

  /// Le jour, la semaine, le mois, tout, et la recherche : une seule requête,
  /// bornée par sentinelle plutôt que par cinq chemins de code séparés.
  ///
  /// Aucun index n'aide la clause de recherche : `LIKE '%awa%'` porte un
  /// joker en tête, que SQLite ne peut indexer. `readsFrom` couvre `outbox`
  /// pour que l'écran se réveille sans qu'aucune synchronisation ne soit
  /// nécessaire : sans lui, une inscription hors ligne n'apparaîtrait qu'au
  /// prochain redémarrage de l'écran.
  Stream<VisitesPage> watch({
    String search = '',
    PeriodeRegistre periode = PeriodeRegistre.jour,
    required DateTime maintenant,
    int limit = registreRowCap,
  }) {
    final (String debut, String fin) = _bornes(periode, maintenant);
    final String motif = '%${search.trim().toLowerCase()}%';
    return _db
        .customSelect(
          'SELECT v.*, $_statutExpr AS sync_status '
          'FROM visites AS v '
          '$_statutJoin'
          'WHERE (?1 = \'\' OR v.date >= ?1) '
          '  AND (?2 = \'\' OR v.date <= ?2) '
          '  AND (?3 = \'%%\' '
          '       OR lower(v.visitor_name) LIKE ?3 '
          '       OR lower(v.entreprise_label) LIKE ?3 '
          '       OR lower(v.objet_label) LIKE ?3 '
          '       OR lower(v.destinataire_label) LIKE ?3 '
          '       OR lower(v.reference) LIKE ?3 '
          '       OR v.phone LIKE ?3 '
          '       OR v.phone_e164 LIKE ?3) '
          'ORDER BY v.date DESC, v.time DESC, v.created_at DESC '
          'LIMIT ?4',
          variables: <Variable<Object>>[
            Variable<String>(debut),
            Variable<String>(fin),
            Variable<String>(motif),
            Variable<int>(limit + 1),
          ],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.visites,
            _db.outbox,
          },
        )
        .watch()
        .map((List<QueryRow> rows) {
          final bool truncated = rows.length > limit;
          final List<QueryRow> bornees = truncated
              ? rows.sublist(0, limit)
              : rows;
          return VisitesPage(
            items: bornees
                .map(VisiteAvecStatut.fromRow)
                .toList(growable: false),
            truncated: truncated,
          );
        });
  }

  (String, String) _bornes(PeriodeRegistre periode, DateTime maintenant) {
    final String aujourdhui = jourDakar(maintenant);
    return switch (periode) {
      PeriodeRegistre.jour => (aujourdhui, aujourdhui),
      PeriodeRegistre.semaine => (
        jourDakar(maintenant.subtract(const Duration(days: 6))),
        aujourdhui,
      ),
      PeriodeRegistre.mois => (
        jourDakar(maintenant.subtract(const Duration(days: 29))),
        aujourdhui,
      ),
      PeriodeRegistre.tout => ('', ''),
    };
  }

  /// Visites du jour, sur les 7 derniers jours glissants, et non encore
  /// parties : les trois compteurs de l'écran des chiffres, en une requête.
  Stream<CompteursAccueil> watchCompteurs(DateTime maintenant) {
    final String aujourdhui = jourDakar(maintenant);
    final String ilYaSeptJours = jourDakar(
      maintenant.subtract(const Duration(days: 6)),
    );
    return _db
        .customSelect(
          'SELECT '
          '  (SELECT COUNT(*) FROM visites WHERE date = ?1) AS jour, '
          '  (SELECT COUNT(*) FROM visites WHERE date >= ?2) AS sept_jours, '
          '  (SELECT COUNT(*) FROM visites AS v $_statutJoin '
          '     WHERE ($_statutExpr) != \'synced\') AS en_attente',
          variables: <Variable<Object>>[
            Variable<String>(aujourdhui),
            Variable<String>(ilYaSeptJours),
          ],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.visites,
            _db.outbox,
          },
        )
        .map(
          (QueryRow row) => CompteursAccueil(
            jour: row.read<int>('jour'),
            septJours: row.read<int>('sept_jours'),
            enAttente: row.read<int>('en_attente'),
          ),
        )
        .watchSingle();
  }

  /// Sept barres, envoyé contre en attente, sur le modèle
  /// d'`activityLast7DaysProvider` : même forme de résultat, fenêtre issue de
  /// [maintenant] plutôt que de `date('now','localtime')`, donc testable sous
  /// `FakeClock`.
  Stream<List<ActivityDay>> watchActivite7Jours(DateTime maintenant) {
    final DateTime aujourdhui = maintenant.toUtc();
    final String depuis = jourDakar(
      aujourdhui.subtract(const Duration(days: 6)),
    );
    return _db
        .customSelect(
          'SELECT v.date AS jour, '
          '       SUM(CASE WHEN ($_statutExpr) = \'synced\' THEN 1 ELSE 0 END) '
          '         AS envoyees, '
          '       SUM(CASE WHEN ($_statutExpr) != \'synced\' THEN 1 ELSE 0 END) '
          '         AS attente '
          'FROM visites AS v '
          '$_statutJoin'
          'WHERE v.date >= ?1 '
          'GROUP BY v.date',
          variables: <Variable<Object>>[Variable<String>(depuis)],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.visites,
            _db.outbox,
          },
        )
        .watch()
        .map((List<QueryRow> rows) {
          final Map<String, QueryRow> parJour = <String, QueryRow>{
            for (final QueryRow r in rows) r.read<String>('jour'): r,
          };
          return List<ActivityDay>.generate(7, (int i) {
            final DateTime jour = DateUtils.dateOnly(
              aujourdhui,
            ).subtract(Duration(days: 6 - i));
            final QueryRow? row = parJour[jourDakar(jour)];
            return ActivityDay(
              day: jour,
              synced: row?.read<int?>('envoyees') ?? 0,
              pending: row?.read<int?>('attente') ?? 0,
            );
          });
        });
  }

  /// Les cinq entreprises et les cinq objets les plus fréquents des 30
  /// derniers jours, en une seule requête plutôt que deux : SQLite trie
  /// l'ensemble par catégorie puis par total, et le découpage en cinq par
  /// catégorie se fait côté Dart.
  Stream<TopLabels> watchTopLabels(DateTime maintenant, {int limit = 5}) {
    final String depuis = jourDakar(
      maintenant.subtract(const Duration(days: 29)),
    );
    return _db
        .customSelect(
          'SELECT \'entreprise\' AS categorie, entreprise_label AS libelle, '
          '       COUNT(*) AS total '
          'FROM visites WHERE date >= ?1 GROUP BY entreprise_label '
          'UNION ALL '
          'SELECT \'objet\', objet_label, COUNT(*) '
          'FROM visites WHERE date >= ?1 GROUP BY objet_label '
          'ORDER BY categorie, total DESC',
          variables: <Variable<Object>>[Variable<String>(depuis)],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{_db.visites},
        )
        .watch()
        .map((List<QueryRow> rows) {
          final List<LabelCompte> entreprises = <LabelCompte>[];
          final List<LabelCompte> objets = <LabelCompte>[];
          for (final QueryRow row in rows) {
            final List<LabelCompte> cible =
                row.read<String>('categorie') == 'entreprise'
                ? entreprises
                : objets;
            if (cible.length >= limit) continue;
            cible.add(
              LabelCompte(
                libelle: row.read<String>('libelle'),
                total: row.read<int>('total'),
              ),
            );
          }
          return TopLabels(entreprises: entreprises, objets: objets);
        });
  }

  /// L'heure qui a vu passer le plus de visiteurs sur les 30 derniers jours.
  Stream<HeureDePointe?> watchHeureDePointe(DateTime maintenant) {
    final String depuis = jourDakar(
      maintenant.subtract(const Duration(days: 29)),
    );
    return _db
        .customSelect(
          'SELECT CAST(substr(time, 1, 2) AS INTEGER) AS heure, '
          '       COUNT(*) AS total '
          'FROM visites '
          'WHERE date >= ?1 AND time IS NOT NULL '
          'GROUP BY heure '
          'ORDER BY total DESC, heure ASC '
          'LIMIT 1',
          variables: <Variable<Object>>[Variable<String>(depuis)],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{_db.visites},
        )
        .watch()
        .map(
          (List<QueryRow> rows) => rows.isEmpty
              ? null
              : HeureDePointe(
                  heure: rows.first.read<int>('heure'),
                  total: rows.first.read<int>('total'),
                ),
        );
  }
}
