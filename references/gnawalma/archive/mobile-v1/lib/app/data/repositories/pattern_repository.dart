import 'package:isar_plus/isar_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../domain/repositories/i_pattern_repository.dart';
import '../models/pattern_model.dart';
import '../services/database_service.dart';
import '../../shared/utils/app_logger.dart';

import 'base_isar_repository.dart';

part 'pattern_repository.g.dart';

@Riverpod(keepAlive: true)
Future<PatternRepository> patternRepository(Ref ref) async {
  final isar = await ref.watch(databaseProvider.future);
  return PatternRepository(isar);
}

/// Implementation of IPatternRepository using Isar
///
/// Handles all pattern-related database operations
class PatternRepository extends BaseIsarRepository<PatternModel>
    implements IPatternRepository {
  PatternRepository(super.isar);

  @override
  IsarCollection<int, PatternModel> getCollection(Isar isar) =>
      isar.patternModels;

  @override
  IsarCollection<int, PatternModel> get collection => isar.patternModels;

  /// Get the patterns collection
  IsarCollection<int, PatternModel> get _patterns => isar.patternModels;

  @override
  Future<void> put(PatternModel item) async {
    final localIsar = isar;
    AppLogger.i('PatternRepository: Saving pattern "${item.name}"');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.patternModels.put(item);
      });
    } catch (e, stack) {
      AppLogger.e('PatternRepository: Error putting pattern', e, stack);
      rethrow;
    }
  }

  @override
  Future<void> putAll(List<PatternModel> items) async {
    final localIsar = isar;
    AppLogger.i('PatternRepository: Saving ${items.length} patterns');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.patternModels.putAll(items);
      });
    } catch (e, stack) {
      AppLogger.e(
        'PatternRepository: Error putting multiple patterns',
        e,
        stack,
      );
      rethrow;
    }
  }

  @override
  Future<void> delete(int id) async {
    final localIsar = isar;
    AppLogger.i('PatternRepository: Deleting pattern ID: $id');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.patternModels.delete(id);
      });
    } catch (e, stack) {
      AppLogger.e('PatternRepository: Error deleting pattern', e, stack);
      rethrow;
    }
  }

  // ===== CRUD Operations =====

  @override
  Future<List<PatternModel>> getAllPatterns() async {
    return getAll();
  }

  @override
  Future<PatternModel?> getPatternById(int id) async {
    return getById(id);
  }

  @override
  Future<int> createPattern(PatternModel pattern) async {
    AppLogger.i('PatternRepository: Creating pattern "${pattern.name}"');
    // Set creation date
    pattern.createdAt = DateTime.now();

    // Update searchable name
    pattern.updateSearchableName();

    if (pattern.id == 0) {
      pattern.id = _patterns.autoIncrement();
    }

    await put(pattern);
    return pattern.id;
  }

  @override
  Future<void> updatePattern(PatternModel pattern) async {
    AppLogger.i(
      'PatternRepository: Updating pattern "${pattern.name}" (ID: ${pattern.id})',
    );
    // Update modification date
    pattern.updatedAt = DateTime.now();

    // Update searchable name
    pattern.updateSearchableName();

    await put(pattern);
  }

  @override
  Future<void> deletePattern(int id) async {
    await delete(id);
  }

  // ===== Queries and Filters =====

  @override
  Future<List<PatternModel>> getPatternsByCategory(
    PatternCategory category,
  ) async {
    return _patterns.where().categoryEqualTo(category).findAllAsync();
  }

  @override
  Future<List<PatternModel>> getPatternsByDifficulty(
    DifficultyLevel difficulty,
  ) async {
    return _patterns.where().difficultyEqualTo(difficulty).findAllAsync();
  }

  @override
  Future<List<PatternModel>> getPatternsByTag(String tag) async {
    return _patterns
        .where()
        .tagsElementContains(tag, caseSensitive: false)
        .findAllAsync();
  }

  @override
  Future<List<PatternModel>> searchPatterns(String query) async {
    final lowercaseQuery = query.toLowerCase();
    return _patterns
        .where()
        .searchableNameContains(lowercaseQuery, caseSensitive: false)
        .findAllAsync();
  }

  @override
  Future<List<PatternModel>> getRecentPatterns({int limit = 10}) async {
    return _patterns.where().sortByCreatedAtDesc().findAllAsync(limit: limit);
  }

  @override
  Future<List<PatternModel>> getMostUsedPatterns({int limit = 10}) async {
    return _patterns.where().sortByTimesUsedDesc().findAllAsync(limit: limit);
  }

  // ===== Updates =====

  @override
  Future<void> incrementTimesUsed(int id) async {
    final pattern = await getById(id);
    if (pattern != null) {
      pattern.timesUsed++;
      await put(pattern);
    }
  }

  @override
  Future<void> decrementTimesUsed(int id) async {
    final pattern = await getById(id);
    if (pattern != null) {
      pattern.timesUsed--;
      if (pattern.timesUsed < 0) pattern.timesUsed = 0;
      await put(pattern);
    }
  }

  // ===== Utilities =====

  @override
  Future<List<String>> getAllTags() async {
    final patterns = await _patterns.where().findAllAsync();

    // Collect all unique tags from all patterns
    final Set<String> uniqueTags = {};
    for (final pattern in patterns) {
      uniqueTags.addAll(pattern.tags);
    }

    // Return as sorted list
    final tagList = uniqueTags.toList()..sort();
    return tagList;
  }

  @override
  Future<Map<PatternCategory, int>> getPatternCountByCategory() async {
    final patterns = await _patterns.where().findAllAsync();

    final Map<PatternCategory, int> counts = {};
    for (final category in PatternCategory.values) {
      counts[category] = 0;
    }

    for (final pattern in patterns) {
      counts[pattern.category] = (counts[pattern.category] ?? 0) + 1;
    }

    return counts;
  }

  @override
  Future<Map<DifficultyLevel, int>> getPatternCountByDifficulty() async {
    final patterns = await _patterns.where().findAllAsync();

    final Map<DifficultyLevel, int> counts = {};
    for (final difficulty in DifficultyLevel.values) {
      counts[difficulty] = 0;
    }

    for (final pattern in patterns) {
      counts[pattern.difficulty] = (counts[pattern.difficulty] ?? 0) + 1;
    }

    return counts;
  }

  @override
  Future<int> getPatternsCount() async {
    return await _patterns.where().countAsync();
  }

  // ===== Real-time Updates =====

  @override
  Stream<List<PatternModel>> watchPatterns() {
    return _patterns.where().watch(fireImmediately: true);
  }

  @override
  Stream<List<PatternModel>> watchPatternsByCategory(PatternCategory category) {
    return _patterns
        .where()
        .categoryEqualTo(category)
        .watch(fireImmediately: true);
  }

  @override
  Stream<PatternModel?> watchPattern(int id) {
    return _patterns.watchObject(id, fireImmediately: true);
  }
}
