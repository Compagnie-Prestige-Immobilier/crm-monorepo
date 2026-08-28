import 'package:crm_api_client/crm_api_client.dart';
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
    required this.entrepriseId,
    required this.entrepriseLabel,
    required this.objetId,
    required this.objetLabel,
    required this.directionId,
    required this.directionLabel,
    required this.destinataireId,
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

  /// Les identifiants autant que les intitulés : la correction et la reprise
  /// d'une visite repassent par les listes, qui se choisissent par `id`.
  final String entrepriseId;
  final String entrepriseLabel;
  final String objetId;
  final String objetLabel;
  final String? directionId;
  final String? directionLabel;
  final String? destinataireId;
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
    entrepriseId: row.read<String>('entreprise_id'),
    entrepriseLabel: row.read<String>('entreprise_label'),
    objetId: row.read<String>('objet_id'),
    objetLabel: row.read<String>('objet_label'),
    directionId: row.read<String?>('direction_id'),
    directionLabel: row.read<String?>('direction_label'),
    destinataireId: row.read<String?>('destinataire_id'),
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
  const TopLabels({
    required this.entreprises,
    required this.objets,
    required this.destinataires,
  });

  final List<LabelCompte> entreprises;
  final List<LabelCompte> objets;
  final List<LabelCompte> destinataires;

  static const TopLabels vide = TopLabels(
    entreprises: [],
    objets: [],
    destinataires: [],
  );
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
          '       OR lower(v.direction_label) LIKE ?3 '
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

  /// Les cinq entreprises, objets et personnes demandées les plus fréquents
  /// de la fenêtre, en une seule requête plutôt que trois : SQLite trie
  /// l'ensemble par catégorie puis par total, et le découpage en cinq par
  /// catégorie se fait côté Dart.
  ///
  /// [jours] vaut 30 pour l'ordre des listes du formulaire, 1 pour la carte
  /// « Reçus aujourd'hui » : même requête, deux fenêtres.
  Stream<TopLabels> watchTopLabels(
    DateTime maintenant, {
    int limit = 5,
    int jours = 30,
  }) {
    final String depuis = jourDakar(
      maintenant.subtract(Duration(days: jours - 1)),
    );
    return _db
        .customSelect(
          'SELECT \'entreprise\' AS categorie, entreprise_label AS libelle, '
          '       COUNT(*) AS total '
          'FROM visites WHERE date >= ?1 GROUP BY entreprise_label '
          'UNION ALL '
          'SELECT \'objet\', objet_label, COUNT(*) '
          'FROM visites WHERE date >= ?1 GROUP BY objet_label '
          'UNION ALL '
          'SELECT \'destinataire\', destinataire_label, COUNT(*) '
          'FROM visites WHERE date >= ?1 AND destinataire_label IS NOT NULL '
          'GROUP BY destinataire_label '
          'ORDER BY categorie, total DESC',
          variables: <Variable<Object>>[Variable<String>(depuis)],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{_db.visites},
        )
        .watch()
        .map((List<QueryRow> rows) {
          final List<LabelCompte> entreprises = <LabelCompte>[];
          final List<LabelCompte> objets = <LabelCompte>[];
          final List<LabelCompte> destinataires = <LabelCompte>[];
          for (final QueryRow row in rows) {
            final List<LabelCompte> cible = switch (row.read<String>(
              'categorie',
            )) {
              'entreprise' => entreprises,
              'objet' => objets,
              _ => destinataires,
            };
            if (cible.length >= limit) continue;
            cible.add(
              LabelCompte(
                libelle: row.read<String>('libelle'),
                total: row.read<int>('total'),
              ),
            );
          }
          return TopLabels(
            entreprises: entreprises,
            objets: objets,
            destinataires: destinataires,
          );
        });
  }

  /// La collection sous laquelle le miroir des listes note son passage.
  static const String miroirReferentiels = 'visite_referentiels';

  /// Recopie les quatre listes de l'accueil TELLES QUE LE SERVEUR LES DONNE.
  ///
  /// Le flux de synchronisation est un delta : il annonce ce qui change,
  /// jamais ce qui disparaît. Une base serveur remontée réattribue des
  /// identifiants neufs aux mêmes intitulés, et l'ancienne génération restait
  /// sur le téléphone — la liste montrait chaque société deux fois et la
  /// visite partait avec un identifiant que le serveur ne connaissait plus
  /// (`VISITE_REFERENTIEL_UNAVAILABLE`). Le miroir efface ce qui n'existe plus.
  ///
  /// Rend le nombre de lignes retirées.
  Future<int> remplacerReferentiels(
    VisiteReferentielsBundleDto bundle, {
    required DateTime maintenant,
  }) async {
    final Map<String, List<VisiteReferentielDto>> parKind =
        <String, List<VisiteReferentielDto>>{
          'entreprises': bundle.entreprises,
          'directions': bundle.directions,
          'destinataires': bundle.destinataires,
          'objets': bundle.objets,
        };

    return _db.transaction(() async {
      int retirees = 0;
      for (final MapEntry<String, List<VisiteReferentielDto>> entry
          in parKind.entries) {
        for (final VisiteReferentielDto r in entry.value) {
          await _db
              .into(_db.visiteReferentiels)
              .insertOnConflictUpdate(
                VisiteReferentielsCompanion.insert(
                  id: r.id,
                  kind: entry.key,
                  code: r.code,
                  label: r.label,
                  isActive: Value<bool>(r.isActive),
                  sortOrder: Value<int>(r.sortOrder.toInt()),
                  localUpdatedAt: maintenant,
                  serverUpdatedAt: Value<DateTime?>(r.updatedAt),
                ),
              );
        }
        final List<String> vivants = entry.value
            .map((VisiteReferentielDto r) => r.id)
            .toList(growable: false);
        retirees +=
            await (_db.delete(_db.visiteReferentiels)..where(
                  (VisiteReferentiels t) =>
                      t.kind.equals(entry.key) & t.id.isNotIn(vivants),
                ))
                .go();
      }
      await _db
          .into(_db.syncState)
          .insertOnConflictUpdate(
            SyncStateCompanion.insert(
              collection: miroirReferentiels,
              lastPulledAt: Value<DateTime?>(maintenant),
            ),
          );
      return retirees;
    });
  }

  /// Vrai tant que les listes n'ont jamais été relues en entier : un téléphone
  /// installé avant le miroir porte encore les doublons, et doit se soigner au
  /// premier passage.
  Future<bool> referentielsJamaisMiroites() async {
    final SyncStateData? row =
        await (_db.select(_db.syncState)
              ..where((SyncState t) => t.collection.equals(miroirReferentiels)))
            .getSingleOrNull();
    return row?.lastPulledAt == null;
  }

  /// Redemande un miroir au prochain passage : un refus du serveur sur une
  /// entrée « qui n'est plus proposée » dit que la liste locale est périmée.
  Future<void> demanderMiroirReferentiels() async {
    await (_db.delete(
      _db.syncState,
    )..where((SyncState t) => t.collection.equals(miroirReferentiels))).go();
  }

  /// Une visite par son identifiant, avec son état d'envoi : « À corriger »
  /// n'a que l'identifiant de l'opération refusée pour ouvrir la correction.
  Future<VisiteAvecStatut?> parId(String id) async {
    final List<QueryRow> rows = await _db
        .customSelect(
          'SELECT v.*, $_statutExpr AS sync_status '
          'FROM visites AS v '
          '$_statutJoin'
          'WHERE v.id = ?1 LIMIT 1',
          variables: <Variable<Object>>[Variable<String>(id)],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.visites,
            _db.outbox,
          },
        )
        .get();
    return rows.isEmpty ? null : VisiteAvecStatut.fromRow(rows.first);
  }

  /// Fenêtre de reconnaissance d'un visiteur déjà venu.
  static const Duration rappelVisiteur = Duration(days: 90);

  /// La dernière visite d'un visiteur dont le nom COMMENCE par [nom], sur
  /// [rappelVisiteur].
  ///
  /// Rapprochement par nom seul : l'accueil n'a ni pièce d'identité ni numéro
  /// obligatoire, et deux homonymes se corrigent à l'œil sur la ligne proposée.
  /// Lecture ponctuelle, pas un flux : elle suit la frappe, pas la base.
  Future<VisiteAvecStatut?> dernierePourNom(
    String nom, {
    required DateTime maintenant,
  }) async {
    final String motif = nom.trim().toLowerCase();
    if (motif.isEmpty) return null;
    final String depuis = jourDakar(maintenant.subtract(rappelVisiteur));
    final List<QueryRow> rows = await _db
        .customSelect(
          'SELECT v.*, $_statutExpr AS sync_status '
          'FROM visites AS v '
          '$_statutJoin'
          'WHERE v.date >= ?1 AND lower(v.visitor_name) LIKE ?2 '
          'ORDER BY v.date DESC, v.time DESC, v.created_at DESC '
          'LIMIT 1',
          variables: <Variable<Object>>[
            Variable<String>(depuis),
            Variable<String>('$motif%'),
          ],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.visites,
            _db.outbox,
          },
        )
        .get();
    return rows.isEmpty ? null : VisiteAvecStatut.fromRow(rows.first);
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
