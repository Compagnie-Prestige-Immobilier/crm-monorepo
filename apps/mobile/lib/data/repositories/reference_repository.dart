import 'package:drift/drift.dart';

import '../../core/sync/api_port.dart' show attributionBorne;
import '../../core/sync/phase2_directory_sync.dart';
import '../local/database.dart';

typedef Region = ({String id, String name});

class ReferenceRepository {
  ReferenceRepository(this._db);

  final AppDatabase _db;

  /// Le périmètre d'appel, en SQL. Le pull de synchronisation est GLOBAL :
  /// sans cette clause, un téléconseiller voit et appelle les fiches de toutes
  /// les campagnes. Tant que le marqueur `borne` n'est pas posé — encadrement,
  /// ou appareil qui n'a pas encore lu ses attributions — rien n'est filtré.
  ///
  /// [moi] se lie en `?1` : `created_by_id` est NON NUL, une chaîne vide ne peut
  /// donc désigner personne.
  static String _perimetre(String kind, {String alias = ''}) {
    final String p = alias.isEmpty ? '' : '$alias.';
    return 'AND (NOT EXISTS (SELECT 1 FROM attributions '
        '                    WHERE kind = \'$attributionBorne\') '
        '     OR ${p}created_by_id = ?1 '
        '     OR ${p}id IN (SELECT a.id FROM attributions AS a '
        '                   WHERE a.kind = \'$kind\')) ';
  }

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

  Stream<List<Profession>> watchProfessions() {
    return (_db.select(_db.professions)
          ..where(
            (Professions t) => t.isActive.equals(true) & t.deletedAt.isNull(),
          )
          ..orderBy(<OrderClauseGenerator<Professions>>[
            (Professions t) => OrderingTerm.asc(t.sortOrder),
            (Professions t) => OrderingTerm.asc(t.label),
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

  /// Les statuts proposés à la qualification d'un représentant. Sans repli :
  /// le champ est facultatif dans le contrat, et une liste vide laisse la
  /// saisie possible plutôt que d'inventer un vocabulaire.
  Stream<List<StatutQualificationRow>> watchStatutsQualification() {
    return (_db.select(_db.statutsQualification)
          ..where((StatutsQualification t) => t.isActive.equals(true))
          ..orderBy(<OrderClauseGenerator<StatutsQualification>>[
            (StatutsQualification t) => OrderingTerm.asc(t.position),
            (StatutsQualification t) => OrderingTerm.asc(t.label),
          ]))
        .watch();
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

  /// [statutId], [relation] et [dernierAppel] vides ne filtrent pas ; la
  /// valeur `JAMAIS` cible les fiches sans statut ou jamais appelées.
  Stream<List<RepresentantSyncViewData>> watchRepresentants({
    String? search,
    String? moi,
    String statutId = '',
    String relation = '',
    String dernierAppel = '',
  }) {
    final String terme = (search ?? '').trim();
    // ponytail: pas de LIMIT, le périmètre borne déjà la liste ; paginer si un
    // compte se retrouve avec plus de quelques milliers de fiches.
    final String pattern = '%${terme.toLowerCase()}%';
    // Un numéro se tape avec des espaces (« 77 152 11 62 ») et se range en
    // E.164 : sans cette seconde forme, aucune recherche par téléphone ne sort.
    final String chiffres = terme.replaceAll(RegExp(r'[^0-9]'), '');
    final String parNumero = chiffres.isEmpty ? '' : '%$chiffres%';
    return _db
        .customSelect(
          'SELECT * FROM representant_sync_view '
          'WHERE deleted_at IS NULL '
          '  AND (lower(full_name) LIKE ?2 OR phone_e164 LIKE ?2 '
          '       OR (?3 <> \'\' AND phone_e164 LIKE ?3)) '
          '  AND (?4 = \'\' OR (?4 = \'JAMAIS\' AND statut_qualification_id IS NULL) '
          '       OR statut_qualification_id = ?4) '
          '  AND (?5 = \'\' OR relation_status = ?5) '
          '  AND (?6 = \'\' OR (?6 = \'JAMAIS\' AND last_call_at IS NULL) '
          '       OR last_call_outcome = ?6) '
          '  ${_perimetre('representant')}'
          'ORDER BY client_created_at DESC',
          variables: <Variable<Object>>[
            Variable<String>(moi ?? ''),
            Variable<String>(pattern),
            Variable<String>(parNumero),
            Variable<String>(statutId),
            Variable<String>(relation),
            Variable<String>(dernierAppel),
          ],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.representants,
            _db.outbox,
            _db.attributions,
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
    String? moi,
    String statut = '',
    String dernierAppel = '',
  }) {
    final String pattern = '%${(search ?? '').trim().toLowerCase()}%';
    final String project = projet ?? '';
    return _db
        .customSelect(
          'SELECT * FROM prospect_sync_view AS v '
          'WHERE deleted_at IS NULL '
          '  AND (?2 = \'\' OR EXISTS ('
          '        SELECT 1 FROM prospect_journeys j '
          '        WHERE j.prospect_id = v.id AND j.projet = ?2)) '
          '  AND (?3 = \'%%\' OR lower(nom) LIKE ?3 OR lower(prenom) LIKE ?3 '
          '       OR phone_e164 LIKE ?3) '
          '  AND (?4 = \'\' OR statut = ?4) '
          '  AND (?5 = \'\' OR (?5 = \'JAMAIS\' AND last_call_at IS NULL) '
          '       OR last_call_outcome = ?5) '
          '  ${_perimetre('prospect', alias: 'v')}'
          'ORDER BY client_created_at DESC LIMIT 500',
          variables: <Variable<Object>>[
            Variable<String>(moi ?? ''),
            Variable<String>(project),
            Variable<String>(pattern),
            Variable<String>(statut),
            Variable<String>(dernierAppel),
          ],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.prospects,
            _db.prospectJourneys,
            _db.outbox,
            _db.attributions,
          },
        )
        .map((QueryRow row) => _db.prospectSyncView.map(row.data))
        .watch();
  }

  /// Sans [projet], toutes les fiches vivantes ; sinon celles du parcours.
  Stream<int> watchProspectCount({String? projet, String? moi}) {
    return _db
        .customSelect(
          'SELECT COUNT(*) AS c FROM prospects AS p '
          'WHERE p.deleted_at IS NULL AND (?2 = \'\' OR EXISTS ('
          '  SELECT 1 FROM prospect_journeys j '
          '  WHERE j.prospect_id = p.id AND j.projet = ?2)) '
          '  ${_perimetre('prospect', alias: 'p')}',
          variables: <Variable<Object>>[
            Variable<String>(moi ?? ''),
            Variable<String>(projet ?? ''),
          ],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.prospects,
            _db.prospectJourneys,
            _db.attributions,
          },
        )
        .map((QueryRow row) => row.read<int>('c'))
        .watchSingle();
  }

  /// Les compteurs de l'accueil lisent le même périmètre que les listes :
  /// une carte « 1 234 représentants » face à une liste bornée mentirait.
  Stream<int> watchRepresentantCount({String? moi}) {
    return _db
        .customSelect(
          'SELECT COUNT(*) AS c FROM representants '
          'WHERE deleted_at IS NULL ${_perimetre('representant')}',
          variables: <Variable<Object>>[Variable<String>(moi ?? '')],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.representants,
            _db.attributions,
          },
        )
        .map((QueryRow row) => row.read<int>('c'))
        .watchSingle();
  }

  Stream<int> watchRepresentantsAppeles({String? moi}) {
    return _db
        .customSelect(
          'SELECT COUNT(*) AS c FROM representants '
          'WHERE deleted_at IS NULL AND last_call_at IS NOT NULL '
          '${_perimetre('representant')}',
          variables: <Variable<Object>>[Variable<String>(moi ?? '')],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.representants,
            _db.attributions,
          },
        )
        .map((QueryRow row) => row.read<int>('c'))
        .watchSingle();
  }

  /// Ambassadeurs chez qui personne n'a encore été saisi : le travail de l'étape 2.
  Stream<int> watchRepresentantsSansProspect({String? moi}) {
    return _db
        .customSelect(
          'SELECT COUNT(*) AS c FROM representants r '
          'WHERE r.deleted_at IS NULL AND r.relation_status = \'AMBASSADEUR\' '
          'AND NOT EXISTS (SELECT 1 FROM prospects p '
          '  WHERE p.representant_id = r.id AND p.deleted_at IS NULL) '
          '${_perimetre('representant', alias: 'r')}',
          variables: <Variable<Object>>[Variable<String>(moi ?? '')],
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
            _db.representants,
            _db.prospects,
            _db.attributions,
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
