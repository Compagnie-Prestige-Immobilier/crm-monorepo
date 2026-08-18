import 'package:drift/drift.dart';

import '../local/database.dart';

typedef Region = ({String id, String name});

class ReferenceRepository {
  ReferenceRepository(this._db);

  final AppDatabase _db;

  /// Les régions, dérivées des départements : il n'existe pas de table
  /// `regions` en local, seulement le libellé dénormalisé que porte chaque
  /// département. Les départements sans libellé sont écartés, sinon la liste
  /// rendrait une entrée sans nom.
  Stream<List<Region>> watchRegions() {
    return _db
        .customSelect(
          'SELECT DISTINCT region_id AS id, region_name AS name FROM departements '
          'WHERE is_active = 1 AND deleted_at IS NULL AND region_name <> \'\' '
          'ORDER BY name',
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{_db.departements},
        )
        .map(
          (QueryRow row) => (id: row.read<String>('id'), name: row.read<String>('name')),
        )
        .watch();
  }

  Stream<List<Departement>> watchDepartements({String? regionId}) {
    final SimpleSelectStatement<Departements, Departement> query =
        _db.select(_db.departements)
          ..where((Departements t) => t.isActive.equals(true) & t.deletedAt.isNull())
          ..orderBy(<OrderClauseGenerator<Departements>>[
            (Departements t) => OrderingTerm.asc(t.name),
          ]);
    if (regionId != null) {
      query.where((Departements t) => t.regionId.equals(regionId));
    }
    return query.watch();
  }

  Stream<List<Ief>> watchIefs({String? departementId}) {
    final SimpleSelectStatement<Iefs, Ief> query = _db.select(_db.iefs)
      ..where((Iefs t) => t.isActive.equals(true) & t.deletedAt.isNull())
      ..orderBy(<OrderClauseGenerator<Iefs>>[
        (Iefs t) => OrderingTerm.asc(t.departementName),
        (Iefs t) => OrderingTerm.asc(t.name),
      ]);
    if (departementId != null) {
      query.where((Iefs t) => t.departementId.equals(departementId));
    }
    return query.watch();
  }

  Future<Ief?> iefById(String id) {
    return (_db.select(_db.iefs)..where((Iefs t) => t.id.equals(id))).getSingleOrNull();
  }

  Stream<List<Banque>> watchBanques() {
    return (_db.select(_db.banques)
          ..where((Banques t) => t.isActive.equals(true) & t.deletedAt.isNull())
          ..orderBy(<OrderClauseGenerator<Banques>>[
            (Banques t) => OrderingTerm.asc(t.sortOrder),
            (Banques t) => OrderingTerm.asc(t.name),
          ]))
        .watch();
  }

  Stream<List<Syndicat>> watchSyndicats() {
    return (_db.select(_db.syndicats)
          ..where((Syndicats t) => t.isActive.equals(true) & t.deletedAt.isNull())
          ..orderBy(<OrderClauseGenerator<Syndicats>>[
            (Syndicats t) => OrderingTerm.asc(t.sortOrder),
            (Syndicats t) => OrderingTerm.asc(t.name),
          ]))
        .watch();
  }

  Future<Representant?> findRepresentantByPhone(String phoneE164) {
    return (_db.select(_db.representants)
          ..where(
            (Representants t) => t.phoneE164.equals(phoneE164) & t.deletedAt.isNull(),
          )
          ..limit(1))
        .getSingleOrNull();
  }

  Future<Prospect?> findProspectByPhone(String phoneE164) {
    return (_db.select(_db.prospects)
          ..where((Prospects t) => t.phoneE164.equals(phoneE164) & t.deletedAt.isNull())
          ..limit(1))
        .getSingleOrNull();
  }

  Future<Departement?> departementById(String id) {
    return (_db.select(
      _db.departements,
    )..where((Departements t) => t.id.equals(id))).getSingleOrNull();
  }

  Stream<List<RepresentantSyncViewData>> watchRepresentants({
    String? search,
    int limit = 500,
  }) {
    final String pattern = '%${(search ?? '').trim().toLowerCase()}%';
    return _db
        .customSelect(
          'SELECT * FROM representant_sync_view '
          'WHERE deleted_at IS NULL '
          '  AND (?1 = \'%%\' OR lower(full_name) LIKE ?1 OR phone_e164 LIKE ?1) '
          'ORDER BY client_created_at DESC '
          'LIMIT ?2',
          variables: <Variable<Object>>[
            Variable<String>(pattern),
            Variable<int>(limit),
          ],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.representants,
            _db.outbox,
          },
        )
        .map((QueryRow row) => _db.representantSyncView.map(row.data))
        .watch();
  }

  Stream<RepresentantSyncViewData?> watchRepresentant(String id) {
    return _db
        .customSelect(
          'SELECT * FROM representant_sync_view WHERE id = ?1 AND deleted_at IS NULL',
          variables: <Variable<Object>>[Variable<String>(id)],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.representants,
            _db.outbox,
          },
        )
        .map((QueryRow row) => _db.representantSyncView.map(row.data))
        .watchSingleOrNull();
  }

  Stream<List<ProspectSyncViewData>> watchProspectsFor(String representantId) {
    return _db.prospectsForRepresentant(representantId: representantId).watch();
  }

  Stream<List<ProspectSyncViewData>> watchAllProspects({String? search}) {
    final String pattern = '%${(search ?? '').trim().toLowerCase()}%';
    return _db
        .customSelect(
          'SELECT * FROM prospect_sync_view '
          'WHERE deleted_at IS NULL '
          '  AND (?1 = \'%%\' OR lower(nom) LIKE ?1 OR lower(prenom) LIKE ?1 '
          '       OR phone_e164 LIKE ?1) '
          'ORDER BY client_created_at DESC LIMIT 500',
          variables: <Variable<Object>>[Variable<String>(pattern)],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.prospects,
            _db.outbox,
          },
        )
        .map((QueryRow row) => _db.prospectSyncView.map(row.data))
        .watch();
  }

  Stream<int> watchProspectCountFor(String representantId) {
    return _db
        .customSelect(
          'SELECT COUNT(*) AS c FROM prospects '
          'WHERE representant_id = ?1 AND deleted_at IS NULL',
          variables: <Variable<Object>>[Variable<String>(representantId)],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{_db.prospects},
        )
        .map((QueryRow row) => row.read<int>('c'))
        .watchSingle();
  }

  Stream<List<OutboxData>> watchNeedsAttention() {
    return (_db.select(_db.outbox)
          ..where((Outbox o) => o.status.isIn(<String>['conflict', 'failed']))
          ..orderBy(<OrderClauseGenerator<Outbox>>[
            (Outbox o) => OrderingTerm.asc(o.seq),
          ]))
        .watch();
  }

  Future<Representant?> representantById(String id) {
    return (_db.select(
      _db.representants,
    )..where((Representants t) => t.id.equals(id))).getSingleOrNull();
  }

  Future<Prospect?> prospectById(String id) {
    return (_db.select(
      _db.prospects,
    )..where((Prospects t) => t.id.equals(id))).getSingleOrNull();
  }

  Future<DateTime?> lastPulledAt() async {
    final SyncStateData? row = await (_db.select(
      _db.syncState,
    )..where((SyncState t) => t.collection.equals('all'))).getSingleOrNull();
    return row?.lastPulledAt;
  }
}
