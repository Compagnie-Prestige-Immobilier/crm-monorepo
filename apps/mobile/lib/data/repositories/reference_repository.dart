import 'package:drift/drift.dart';

import '../../core/sync/phase2_directory_sync.dart';
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
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.departements,
          },
        )
        .map(
          (QueryRow row) =>
              (id: row.read<String>('id'), name: row.read<String>('name')),
        )
        .watch();
  }

  Stream<List<Departement>> watchDepartements({String? regionId}) {
    final SimpleSelectStatement<Departements, Departement> query =
        _db.select(_db.departements)
          ..where(
            (Departements t) => t.isActive.equals(true) & t.deletedAt.isNull(),
          )
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
    return (_db.select(
      _db.iefs,
    )..where((Iefs t) => t.id.equals(id))).getSingleOrNull();
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
          ..where(
            (Syndicats t) => t.isActive.equals(true) & t.deletedAt.isNull(),
          )
          ..orderBy(<OrderClauseGenerator<Syndicats>>[
            (Syndicats t) => OrderingTerm.asc(t.sortOrder),
            (Syndicats t) => OrderingTerm.asc(t.name),
          ]))
        .watch();
  }

  Stream<List<CanauxProvenanceData>> watchCanauxProvenance() {
    return (_db.select(_db.canauxProvenance)
          ..where(
            (CanauxProvenance t) =>
                t.isActive.equals(true) & t.deletedAt.isNull(),
          )
          ..orderBy(<OrderClauseGenerator<CanauxProvenance>>[
            (CanauxProvenance t) => OrderingTerm.asc(t.sortOrder),
            (CanauxProvenance t) => OrderingTerm.asc(t.label),
          ]))
        .watch();
  }

  Stream<List<IncomeBand>> watchIncomeBands() {
    return (_db.select(_db.incomeBands)
          ..where(
            (IncomeBands t) => t.isActive.equals(true) & t.deletedAt.isNull(),
          )
          ..orderBy(<OrderClauseGenerator<IncomeBands>>[
            (IncomeBands t) => OrderingTerm.asc(t.sortOrder),
            (IncomeBands t) => OrderingTerm.asc(t.label),
          ]))
        .watch();
  }

  Stream<List<Employeur>> watchEmployeurs() {
    return (_db.select(_db.employeurs)
          ..where(
            (Employeurs t) => t.isActive.equals(true) & t.deletedAt.isNull(),
          )
          ..orderBy(<OrderClauseGenerator<Employeurs>>[
            (Employeurs t) => OrderingTerm.asc(t.sortOrder),
            (Employeurs t) => OrderingTerm.asc(t.label),
          ]))
        .watch();
  }

  Stream<List<PaysRow>> watchPays() {
    return (_db.select(_db.pays)
          ..where((Pays t) => t.isActive.equals(true) & t.deletedAt.isNull())
          ..orderBy(<OrderClauseGenerator<Pays>>[
            (Pays t) => OrderingTerm.asc(t.sortOrder),
            (Pays t) => OrderingTerm.asc(t.label),
          ]))
        .watch();
  }

  /// Les motifs d'issue proposés à la saisie, avec repli sur les six motifs
  /// système tant que la table est vide : au premier lancement, avant la
  /// première synchronisation, le téléconseiller doit pouvoir enregistrer un
  /// appel.
  Stream<List<CallReason>> watchCallReasons() {
    return (_db.select(_db.callOutcomeReasons)
          ..where((CallOutcomeReasons t) => t.isActive.equals(true))
          ..orderBy(<OrderClauseGenerator<CallOutcomeReasons>>[
            (CallOutcomeReasons t) => OrderingTerm.asc(t.sortOrder),
            (CallOutcomeReasons t) => OrderingTerm.asc(t.label),
          ]))
        .watch()
        .map(
          (List<CallOutcomeReason> rows) => rows.isEmpty
              ? SystemCallReasons.all
              : rows.map(CallReason.fromRow).toList(growable: false),
        );
  }

  Future<Representant?> findRepresentantByPhone(String phoneE164) {
    return (_db.select(_db.representants)
          ..where(
            (Representants t) =>
                t.phoneE164.equals(phoneE164) & t.deletedAt.isNull(),
          )
          ..limit(1))
        .getSingleOrNull();
  }

  Future<Prospect?> findProspectByPhone(String phoneE164) {
    return (_db.select(_db.prospects)
          ..where(
            (Prospects t) =>
                t.phoneE164.equals(phoneE164) & t.deletedAt.isNull(),
          )
          ..limit(1))
        .getSingleOrNull();
  }

  Future<Departement?> departementById(String id) {
    return (_db.select(
      _db.departements,
    )..where((Departements t) => t.id.equals(id))).getSingleOrNull();
  }

  Stream<List<RepresentantSyncViewData>> watchRepresentants({String? search}) {
    final String terme = (search ?? '').trim();
    // Annuaire de milliers de fiches : tout dérouler laisse croire à un total
    // faux (« il n'y en a que 500 »). L'écran reste vide tant qu'on n'a pas
    // cherché ; un résultat n'apparaît que pour une recherche explicite.
    if (terme.isEmpty) {
      return Stream<List<RepresentantSyncViewData>>.value(const []);
    }
    final String pattern = '%${terme.toLowerCase()}%';
    // Un numéro se tape avec des espaces (« 77 152 11 62 ») et se range en
    // E.164 : sans cette seconde forme, aucune recherche par téléphone ne sort.
    final String chiffres = terme.replaceAll(RegExp(r'[^0-9]'), '');
    final String parNumero = chiffres.isEmpty ? '' : '%$chiffres%';
    return _db
        .customSelect(
          'SELECT * FROM representant_sync_view '
          'WHERE deleted_at IS NULL '
          '  AND (lower(full_name) LIKE ?1 OR phone_e164 LIKE ?1 '
          '       OR (?2 <> \'\' AND phone_e164 LIKE ?2)) '
          'ORDER BY client_created_at DESC',
          variables: <Variable<Object>>[
            Variable<String>(pattern),
            Variable<String>(parNumero),
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

  Stream<ProspectSyncViewData?> watchProspect(String id) {
    return _db
        .customSelect(
          'SELECT * FROM prospect_sync_view WHERE id = ?1 AND deleted_at IS NULL',
          variables: <Variable<Object>>[Variable<String>(id)],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.prospects,
            _db.outbox,
          },
        )
        .map((QueryRow row) => _db.prospectSyncView.map(row.data))
        .watchSingleOrNull();
  }

  /// Un cran au-dessus de ce qu'une fiche porte en pratique: la coupure existe
  /// pour borner le rendu, pas pour cacher des lignes. L'ecran la signale.
  static const int ficheRowCap = 200;

  Stream<List<ProspectSyncViewData>> watchProspectsFor(
    String representantId, {
    int maxRows = ficheRowCap,
  }) {
    return _db
        .prospectsForRepresentant(
          representantId: representantId,
          maxRows: maxRows,
        )
        .watch();
  }

  Stream<List<RepresentantComment>> watchCommentsFor(
    String representantId, {
    int maxRows = ficheRowCap,
  }) {
    return _db
        .commentsForRepresentant(
          representantId: representantId,
          maxRows: maxRows,
        )
        .watch();
  }

  Stream<List<ProspectSyncViewData>> watchAllProspects({
    String? search,
    String? projet,
  }) {
    final String pattern = '%${(search ?? '').trim().toLowerCase()}%';
    final String project = projet ?? '';
    return _db
        .customSelect(
          'SELECT * FROM prospect_sync_view AS v '
          'WHERE deleted_at IS NULL '
          '  AND (?1 = \'\' OR EXISTS ('
          '        SELECT 1 FROM prospect_journeys j '
          '        WHERE j.prospect_id = v.id AND j.projet = ?1)) '
          '  AND (?2 = \'%%\' OR lower(nom) LIKE ?2 OR lower(prenom) LIKE ?2 '
          '       OR phone_e164 LIKE ?2) '
          'ORDER BY client_created_at DESC LIMIT 500',
          variables: <Variable<Object>>[
            Variable<String>(project),
            Variable<String>(pattern),
          ],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.prospects,
            _db.prospectJourneys,
            _db.outbox,
          },
        )
        .map((QueryRow row) => _db.prospectSyncView.map(row.data))
        .watch();
  }

  Stream<int> watchProspectCount({required String projet}) {
    return _db
        .customSelect(
          'SELECT COUNT(*) AS c FROM prospects AS p '
          'WHERE p.deleted_at IS NULL AND EXISTS ('
          '  SELECT 1 FROM prospect_journeys j '
          '  WHERE j.prospect_id = p.id AND j.projet = ?1)',
          variables: <Variable<Object>>[Variable<String>(projet)],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.prospects,
            _db.prospectJourneys,
          },
        )
        .map((QueryRow row) => row.read<int>('c'))
        .watchSingle();
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
