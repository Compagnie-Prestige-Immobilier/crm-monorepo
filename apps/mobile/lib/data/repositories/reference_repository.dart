import 'package:drift/drift.dart';

import '../local/database.dart';

/// Lectures des référentiels et des listes : **Dart pur**.
///
/// Toutes les recherches de l'app (département, banque, syndicat) tapent
/// **uniquement la base locale**. C'est le point de conception : la saisie doit
/// être instantanée et fonctionner sans réseau. Une autocomplétion qui
/// interrogerait le serveur mettrait 4 s à répondre sur un lien EDGE et
/// afficherait une liste vide dans un village : c'est-à-dire exactement là où
/// l'app sert.
class ReferenceRepository {
  ReferenceRepository(this._db);

  final AppDatabase _db;

  Stream<List<Departement>> watchDepartements() {
    return (_db.select(_db.departements)
          ..where((Departements t) => t.isActive.equals(true) & t.deletedAt.isNull())
          ..orderBy(<OrderClauseGenerator<Departements>>[
            (Departements t) => OrderingTerm.asc(t.name),
          ]))
        .watch();
  }

  /// Les IEF, éventuellement restreintes à un département.
  ///
  /// Le tri est (département, nom) : une liste alphabétique globale placerait
  /// « Bignona 1 » entre deux IEF de Dakar, et le sélecteur deviendrait
  /// illisible dès qu'on cherche par zone.
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

  /// Recherche locale d'un représentant par téléphone E.164.
  ///
  /// Première ligne de défense contre le doublon, et la seule qui marche hors
  /// ligne. Le serveur reste consulté quand il répond, mais on ne l'attend pas
  /// pour prévenir l'utilisateur.
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

  /// Représentants avec leur statut de synchronisation, filtrés côté SQL.
  ///
  /// Le filtre est en SQL et pas en Dart : à 400 représentants, filtrer en Dart
  /// signifie relire et désérialiser 400 lignes à chaque frappe de la recherche.
  ///
  /// ## Pourquoi une LIMITE, comme pour les prospects
  ///
  /// Cette requête est un FLUX drift adossé à `representants` **et à `outbox`**.
  /// L'outbox change à chaque écriture, à chaque prise de bail, à chaque
  /// acquittement : c'est-à-dire des centaines de fois pendant une vidange. À
  /// chacun de ces changements, la vue entière était rematérialisée : jointure
  /// sur l'outbox comprise, sans borne. L'équivalent prospect était plafonné à
  /// 500 depuis le début ; l'omission ici était une omission, pas une décision.
  ///
  /// Au-delà de la limite, c'est le champ de recherche qui prend le relais : il
  /// filtre en SQL, donc il atteint toujours la fiche voulue.
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

  /// Nombre de prospects saisis pour un représentant. Alimente le compteur
  /// « 7 prospects ajoutés » de l'écran de saisie rapide.
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

  /// Les opérations qui demandent une action humaine, avec de quoi les décrire.
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
