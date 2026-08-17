import 'dart:convert';
import 'dart:developer' as developer;

import 'package:drift/drift.dart';

import '../../core/sync/clock.dart';
import '../local/database.dart';

const int kDraftSchemaVersion = 1;

enum DraftAge {
  crash,

  resumable,

  stale,
}

class DraftSnapshot {
  const DraftSnapshot({
    required this.draftId,
    required this.formKey,
    required this.values,
    required this.step,
    required this.age,
    required this.updatedAt,
    this.entityId,
    this.parentId,
  });

  final String draftId;
  final String formKey;
  final Map<String, Object?> values;
  final int step;
  final DraftAge age;
  final DateTime updatedAt;
  final String? entityId;
  final String? parentId;
}

class DraftRepository {
  DraftRepository(this._db, {Clock clock = const SystemClock()}) : _clock = clock;

  static const Duration silentRestoreWindow = Duration(seconds: 60);
  static const Duration keepFor = Duration(days: 7);

  final AppDatabase _db;
  final Clock _clock;

  Future<void> save({
    required String draftId,
    required String formKey,
    required Map<String, Object?> values,
    int step = 0,
    String? entityId,
    String? parentId,
  }) {
    return _db
        .into(_db.formDrafts)
        .insertOnConflictUpdate(
          FormDraftsCompanion.insert(
            draftId: draftId,
            formKey: formKey,
            entityId: Value<String?>(entityId),
            parentId: Value<String?>(parentId),
            payload: jsonEncode(values),
            step: Value<int>(step),
            schemaVersion: const Value<int>(kDraftSchemaVersion),
            updatedAt: _clock.now(),
          ),
        );
  }

  Future<void> delete(String draftId) async {
    await (_db.delete(
      _db.formDrafts,
    )..where((FormDrafts t) => t.draftId.equals(draftId))).go();
  }

  Future<DraftSnapshot?> read(String draftId) async {
    final FormDraft? row = await (_db.select(
      _db.formDrafts,
    )..where((FormDrafts t) => t.draftId.equals(draftId))).getSingleOrNull();
    if (row == null) return null;
    return _decode(row);
  }

  Future<DraftSnapshot?> latestFor(String formKey) async {
    final List<FormDraft> rows =
        await (_db.select(_db.formDrafts)
              ..where((FormDrafts t) => t.formKey.equals(formKey))
              ..orderBy(<OrderClauseGenerator<FormDrafts>>[
                (FormDrafts t) => OrderingTerm.desc(t.updatedAt),
              ])
              ..limit(5))
            .get();
    for (final FormDraft row in rows) {
      final DraftSnapshot? snapshot = await _decode(row);
      if (snapshot != null) return snapshot;
    }
    return null;
  }

  Future<DraftSnapshot?> forEntity(String formKey, String entityId) async {
    final List<FormDraft> rows =
        await (_db.select(_db.formDrafts)
              ..where(
                (FormDrafts t) =>
                    t.formKey.equals(formKey) & t.entityId.equals(entityId),
              )
              ..orderBy(<OrderClauseGenerator<FormDrafts>>[
                (FormDrafts t) => OrderingTerm.desc(t.updatedAt),
              ])
              ..limit(5))
            .get();
    for (final FormDraft row in rows) {
      final DraftSnapshot? snapshot = await _decode(row);
      if (snapshot != null) return snapshot;
    }
    return null;
  }

  Future<bool> exists(String draftId) async {
    final FormDraft? row = await (_db.select(
      _db.formDrafts,
    )..where((FormDrafts t) => t.draftId.equals(draftId))).getSingleOrNull();
    return row != null;
  }

  Future<int> purgeStale() async {
    final DateTime cutoff = _clock.now().subtract(keepFor);
    final List<FormDraft> all = await _db.select(_db.formDrafts).get();
    final List<String> doomed = all
        .where(
          (FormDraft d) =>
              d.updatedAt.isBefore(cutoff) || d.schemaVersion != kDraftSchemaVersion,
        )
        .map((FormDraft d) => d.draftId)
        .toList(growable: false);
    if (doomed.isEmpty) return 0;
    await (_db.delete(
      _db.formDrafts,
    )..where((FormDrafts t) => t.draftId.isIn(doomed))).go();
    return doomed.length;
  }

  Future<DraftSnapshot?> _decode(FormDraft row) async {
    if (row.schemaVersion != kDraftSchemaVersion) {
      developer.log(
        'Brouillon ${row.draftId} ignoré : schéma ${row.schemaVersion} '
        '≠ $kDraftSchemaVersion.',
        name: 'cpi.drafts',
      );
      await delete(row.draftId);
      return null;
    }

    final Map<String, Object?> values;
    try {
      final Object? decoded = jsonDecode(row.payload);
      if (decoded is! Map) throw const FormatException('payload non objet');
      values = decoded.cast<String, Object?>();
    } on FormatException catch (e) {
      developer.log(
        'Brouillon ${row.draftId} illisible, supprimé : $e',
        name: 'cpi.drafts',
      );
      await delete(row.draftId);
      return null;
    }

    final Duration age = _clock.now().difference(row.updatedAt);
    if (age > keepFor) {
      await delete(row.draftId);
      return null;
    }

    return DraftSnapshot(
      draftId: row.draftId,
      formKey: row.formKey,
      values: values,
      step: row.step,
      updatedAt: row.updatedAt,
      entityId: row.entityId,
      parentId: row.parentId,
      age: age <= silentRestoreWindow ? DraftAge.crash : DraftAge.resumable,
    );
  }
}
