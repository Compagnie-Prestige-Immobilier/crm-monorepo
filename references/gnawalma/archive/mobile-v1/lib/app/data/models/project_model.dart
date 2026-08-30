import 'package:flutter/material.dart';
import 'package:isar_plus/isar_plus.dart';
import '../../shared/extensions/date_extensions.dart';
import '../../shared/theme/app_colors.dart';

part 'project_model.g.dart';

/// Represents a sewing project in the application
///
/// A project tracks all aspects of a sewing task including:
/// - Basic information (name, garment type, dates)
/// - Status and progress tracking
/// - Material usage (fabric and supplies)
/// - Client association
/// - Photos and notes
/// - Financial information
@collection
class ProjectModel {
  int id = 0;

  // ===== Basic Information =====

  /// Name/title of the project
  late String name;

  /// Type of garment being created (e.g., "Robe", "Pantalon", "Veste")
  late String garmentType;

  /// Optional description or notes about the project
  String? description;

  /// Special event tag (e.g., "Tabaski 2024", "Magal")
  /// Allows grouping projects by event deadline
  String? eventTag;

  // ===== Dates =====

  /// When the project was created in the system
  late DateTime createdAt;

  /// Optional start date for the project
  DateTime? startDate;

  /// Expected delivery date
  DateTime? expectedDeliveryDate;

  /// Actual delivery date (set when project is delivered)
  DateTime? actualDeliveryDate;

  // ===== Status and Progress =====

  /// Current status of the project
  late ProjectStatus status;

  /// Whether this project is currently in "Retouch" mode (alterations needed)
  bool isRetouch = false;

  /// Whether this project is archived (e.g., ghost client, long dormant)
  bool isArchived = false;

  /// Progress percentage (0-100)
  /// Calculated from completed steps / total steps
  double progressPercentage = 0.0;

  /// List of completed step descriptions
  List<String> completedSteps = [];

  /// List of all step descriptions (including completed and pending)
  List<String> allSteps = [];

  // ===== Client Association =====

  /// ID of the client for this project (references ClientModel)
  /// This is the PAYER - the person who ordered and pays
  @Index()
  int? clientId;

  /// ID of the parent order (references OrderModel)
  @Index()
  int? orderId;

  // ===== Beneficiary (For Whom) =====

  /// ID of the beneficiary this garment is for (references BeneficiaryModel)
  /// If null, the garment is for the client themselves
  int? beneficiaryId;

  /// Display label for who this garment is for
  /// e.g., "Moi-même", "Époux", "Enfant 1"
  /// Stored separately for quick display without lookup
  String? forWhom;

  // ===== Pattern Integration =====

  /// ID of the pattern used for this project (references PatternModel)
  int? patternId;

  // ===== Media =====

  /// List of local file paths to project photos
  /// (pattern photos, work in progress, final result, etc.)
  List<String> photoUrls = [];

  /// Specific photo of the fabric for this project (from Order flow)
  String? fabricPhotoUrl;

  /// Snapshot of measurements at the time of order
  /// Stored as JSON string to ensure immutability
  String? measurementsSnapshot;

  /// Mesures dictées ou recopiées telles quelles.
  ///
  /// Les huit champs structurés ne couvrent pas ce qu'un client énonce au
  /// téléphone ou apporte écrit sur un papier. Ce texte est conservé à côté
  /// d'eux, sans être interprété.
  String? measurementNotes;

  // ===== Notes =====

  /// Additional notes about the project
  String? notes;

  /// Path to a voice note/audio recording for this project
  String? audioNotePath;

  // ===== Financial =====

  /// Estimated price for the project
  double? estimatedPrice;

  /// Actual final price charged
  double? actualPrice;

  /// Amount paid in advance by the client (Acompte)
  double? advancePayment;

  /// Calculate remaining amount to be paid
  /// Returns 0 if actualPrice is null (price not set yet)
  double get remainingAmount {
    final price = actualPrice ?? estimatedPrice ?? 0.0;
    final advance = advancePayment ?? 0.0;
    return price - advance;
  }

  /// Calculate progress percentage based on completed vs total steps
  void calculateProgress() {
    if (allSteps.isEmpty) {
      progressPercentage = 0.0;
      return;
    }
    progressPercentage = (completedSteps.length / allSteps.length) * 100;
  }

  /// Check if a step is completed
  bool isStepCompleted(String step) {
    return completedSteps.contains(step);
  }

  /// Toggle a step's completion status
  void toggleStep(String step) {
    if (completedSteps.contains(step)) {
      completedSteps.remove(step);
    } else {
      completedSteps.add(step);
    }
    calculateProgress();
  }

  /// Check if the project is overdue
  bool get isOverdue {
    if (expectedDeliveryDate == null) return false;
    if (status == ProjectStatus.delivered ||
        status == ProjectStatus.completed) {
      return false;
    }
    return expectedDeliveryDate!.isBeforeToday;
  }

  /// Get the number of days until delivery (negative if overdue)
  int? get daysUntilDelivery => expectedDeliveryDate?.daysFromNow;
}

/// Project status enum
enum ProjectStatus {
  /// Project hasn't been started yet
  todo,

  /// Project is currently being worked on
  inProgress,

  /// Project is finished but not yet delivered to client
  completed,

  /// Project has been delivered to client
  delivered,
}

extension ProjectStatusExtension on ProjectStatus {
  Color get color {
    switch (this) {
      case ProjectStatus.todo:
        return AppColors.statusTodo;
      case ProjectStatus.inProgress:
        return AppColors.statusInProgress;
      case ProjectStatus.completed:
        return AppColors.statusCompleted;
      case ProjectStatus.delivered:
        return AppColors.statusDelivered;
    }
  }

  String get label {
    switch (this) {
      case ProjectStatus.todo:
        return 'À faire';
      case ProjectStatus.inProgress:
        return 'En cours';
      case ProjectStatus.completed:
        return 'Terminé';
      case ProjectStatus.delivered:
        return 'Livré';
    }
  }

  IconData get icon {
    switch (this) {
      case ProjectStatus.todo:
        return Icons.radio_button_unchecked_rounded;
      case ProjectStatus.inProgress:
        return Icons.play_circle_outline_rounded;
      case ProjectStatus.completed:
        return Icons.check_circle_outline_rounded;
      case ProjectStatus.delivered:
        return Icons.verified_outlined;
    }
  }
}
