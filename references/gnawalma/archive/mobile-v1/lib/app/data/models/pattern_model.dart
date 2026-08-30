import 'package:isar_plus/isar_plus.dart';

part 'pattern_model.g.dart';

/// Represents a sewing pattern in the pattern library
///
/// A pattern contains all information about a sewing template including:
/// - Basic information (name, category, difficulty)
/// - Pattern files (PDF) and photos
/// - Organization (tags, estimated time)
/// - Instructions and notes
/// - Gallery of completed projects using this pattern
@collection
class PatternModel {
  int id = 0;

  // ===== Basic Information =====

  /// Name of the pattern
  late String name;

  /// Category/type of the pattern
  late PatternCategory category;

  /// Optional description of the pattern
  String? description;

  // ===== Media =====

  /// Local file path to PDF pattern document (optional)
  String? pdfPath;

  /// List of pattern photo URLs (design photos, technical drawings, etc.)
  List<String> photoUrls = [];

  // ===== Organization =====

  /// Customizable tags for organizing patterns
  List<String> tags = [];

  /// Difficulty level of the pattern
  late DifficultyLevel difficulty;

  // ===== Project Estimation =====

  /// Estimated time to complete this pattern in hours
  int? estimatedTimeInHours;

  // ===== Instructions =====

  /// Step-by-step instructions for following the pattern
  String? instructions;

  /// Additional notes about the pattern
  String? notes;

  // ===== Gallery =====

  /// Photos of completed projects using this pattern
  /// These showcase real-world results and inspire users
  List<String> galleryPhotoUrls = [];

  // ===== Tracking =====

  /// When this pattern was added to the library
  late DateTime createdAt;

  /// Last time this pattern was updated
  DateTime? updatedAt;

  /// Number of projects that have used this pattern
  /// Incremented when a project is linked to this pattern
  int timesUsed = 0;

  // ===== Search Optimization =====

  /// Lowercase name for efficient searching
  @Index()
  String? searchableName;

  /// Update the searchable name field
  /// Call this after changing the name
  void updateSearchableName() {
    searchableName = name.toLowerCase();
  }

  /// Get a display string for the estimated time
  String? get estimatedTimeDisplay {
    if (estimatedTimeInHours == null) return null;
    if (estimatedTimeInHours! < 1) return 'Moins d\'une heure';
    if (estimatedTimeInHours == 1) return '1 heure';
    return '$estimatedTimeInHours heures';
  }

  /// Get the difficulty level as a localized string
  String get difficultyDisplay {
    switch (difficulty) {
      case DifficultyLevel.beginner:
        return 'Débutant';
      case DifficultyLevel.intermediate:
        return 'Intermédiaire';
      case DifficultyLevel.advanced:
        return 'Avancé';
      case DifficultyLevel.expert:
        return 'Expert';
    }
  }

  /// Get the category as a localized string
  String get categoryDisplay {
    switch (category) {
      case PatternCategory.dress:
        return 'Robe';
      case PatternCategory.pants:
        return 'Pantalon';
      case PatternCategory.shirt:
        return 'Chemise';
      case PatternCategory.skirt:
        return 'Jupe';
      case PatternCategory.jacket:
        return 'Veste';
      case PatternCategory.accessory:
        return 'Accessoire';
      case PatternCategory.other:
        return 'Autre';
    }
  }
}

/// Category/type of sewing pattern
enum PatternCategory {
  /// Dress pattern (Robe)
  dress,

  /// Pants/trousers pattern (Pantalon)
  pants,

  /// Shirt/blouse pattern (Chemise)
  shirt,

  /// Skirt pattern (Jupe)
  skirt,

  /// Jacket/coat pattern (Veste)
  jacket,

  /// Accessory pattern (bags, scarves, etc.)
  accessory,

  /// Other type not listed above
  other,
}

/// Difficulty level of a pattern
enum DifficultyLevel {
  /// Beginner level - suitable for those new to sewing
  beginner,

  /// Intermediate level - requires some sewing experience
  intermediate,

  /// Advanced level - for experienced sewers
  advanced,

  /// Expert level - complex patterns requiring mastery
  expert,
}
