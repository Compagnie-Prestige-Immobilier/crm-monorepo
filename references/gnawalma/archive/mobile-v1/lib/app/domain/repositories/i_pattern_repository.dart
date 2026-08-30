import '../../data/models/pattern_model.dart';

/// Repository interface for Pattern operations
///
/// Defines all CRUD operations and queries for sewing patterns
/// Implementations handle the actual data access logic
abstract class IPatternRepository {
  // ===== CRUD Operations =====

  /// Get all patterns
  Future<List<PatternModel>> getAllPatterns();

  /// Get a pattern by ID
  Future<PatternModel?> getPatternById(int id);

  /// Create a new pattern
  /// Returns the ID of the created pattern
  Future<int> createPattern(PatternModel pattern);

  /// Update an existing pattern
  Future<void> updatePattern(PatternModel pattern);

  /// Delete a pattern by ID
  Future<void> deletePattern(int id);

  // ===== Queries and Filters =====

  /// Get patterns filtered by category
  Future<List<PatternModel>> getPatternsByCategory(PatternCategory category);

  /// Get patterns filtered by difficulty level
  Future<List<PatternModel>> getPatternsByDifficulty(
    DifficultyLevel difficulty,
  );

  /// Get patterns that have a specific tag
  Future<List<PatternModel>> getPatternsByTag(String tag);

  /// Search patterns by name
  /// Uses the searchableName index for efficient searching
  Future<List<PatternModel>> searchPatterns(String query);

  /// Get recently added patterns (limit: n)
  Future<List<PatternModel>> getRecentPatterns({int limit = 10});

  /// Get most used patterns (sorted by timesUsed)
  Future<List<PatternModel>> getMostUsedPatterns({int limit = 10});

  // ===== Updates =====

  /// Increment the times used counter for a pattern
  /// Called when a project is linked to this pattern
  Future<void> incrementTimesUsed(int id);

  /// Decrement the times used counter for a pattern
  /// Called when a project unlinks from this pattern
  Future<void> decrementTimesUsed(int id);

  // ===== Utilities =====

  /// Get all unique tags used across all patterns
  /// Useful for tag autocomplete or filtering UI
  Future<List<String>> getAllTags();

  /// Get count of patterns by category
  Future<Map<PatternCategory, int>> getPatternCountByCategory();

  /// Get count of patterns by difficulty
  Future<Map<DifficultyLevel, int>> getPatternCountByDifficulty();

  /// Get total number of patterns in library
  Future<int> getPatternsCount();

  // ===== Real-time Updates =====

  /// Watch for changes to all patterns
  /// Returns a stream that emits whenever patterns are added, updated, or deleted
  Stream<List<PatternModel>> watchPatterns();

  /// Watch for changes to patterns with a specific category
  Stream<List<PatternModel>> watchPatternsByCategory(PatternCategory category);

  /// Watch a specific pattern by ID
  Stream<PatternModel?> watchPattern(int id);
}
