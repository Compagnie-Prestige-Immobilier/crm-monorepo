import 'package:isar_plus/isar_plus.dart';

part 'client_model.g.dart';

/// Represents a client in the application
///
/// Tracks client information including:
/// - Personal details
/// - Measurement history
/// - Preferences
/// - Order/project associations
/// - Statistics
@collection
class ClientModel {
  int id = 0;

  // ===== Personal Information =====

  /// Client's first name
  late String firstName;

  /// Client's last name
  late String lastName;

  /// Gender of the client (defaults to female)
  Gender gender = Gender.female;

  /// Phone number
  String? phone;

  /// Email address
  String? email;

  /// Physical address
  String? address;

  // ===== Search Optimization =====

  /// Full name for search indexing (computed: firstName + lastName)
  /// Indexed for fast search queries
  @Index()
  String? fullName;

  // ===== Measurements =====

  /// Historical measurements for this client
  /// Allows tracking changes over time
  List<MeasurementRecord> measurements = [];

  // ===== Preferences =====

  /// Client's favorite colors
  List<String> favoriteColors = [];

  /// Client's preferred styles
  List<String> preferredStyles = [];

  /// Additional notes about the client
  String? notes;

  // ===== Order History =====

  /// IDs of orders associated with this client
  List<int> orderIds = [];

  // ===== Statistics =====

  /// Total number of orders from this client
  late int totalOrders;

  /// Total amount spent by this client
  late double totalSpent;

  /// Trustworthiness score (1-5) for payment reliability
  /// 1: Very risky (often late/unpaid)
  /// 5: Very reliable (always pays on time)
  /// Defaults to 3 (Neutral)
  int trustScore = 3;

  // ===== Tracking =====

  /// When this client was created in the system
  late DateTime createdAt;

  /// Date of the last order
  DateTime? lastOrderDate;

  // ===== Helper Methods =====

  /// Update the full name field for search
  void updateFullName() {
    fullName = '$firstName $lastName'.toLowerCase();
  }

  /// Get the most recent measurement record
  MeasurementRecord? get latestMeasurement {
    if (measurements.isEmpty) return null;
    final sorted = List<MeasurementRecord>.from(measurements);
    sorted.sort((a, b) => b.recordedDate.compareTo(a.recordedDate));
    return sorted.first;
  }

  /// Add a new measurement record
  void addMeasurement(MeasurementRecord measurement) {
    measurements.add(measurement);
  }

  /// Get display name
  String get displayName => '$firstName $lastName';

  /// Get initials
  String get initials {
    final f = firstName.isNotEmpty ? firstName[0] : '';
    final l = lastName.isNotEmpty ? lastName[0] : '';
    return '$f$l'.toUpperCase();
  }

  /// Check if client is active (has ordered recently)
  bool isActive({int daysThreshold = 90}) {
    if (lastOrderDate == null) return false;
    final daysSinceLastOrder = DateTime.now().difference(lastOrderDate!).inDays;
    return daysSinceLastOrder <= daysThreshold;
  }
}

/// Represents a set of measurements taken at a specific date
///
/// This is an embedded object stored within ClientModel
/// Allows tracking measurement changes over time
@embedded
class MeasurementRecord {
  /// When these measurements were recorded
  late DateTime recordedDate;

  // ===== Standard Body Measurements (in centimeters) =====

  /// Tour de poitrine / Bust circumference
  double? bustCircumference;

  /// Tour de taille / Waist circumference
  double? waistCircumference;

  /// Tour de hanches / Hip circumference
  double? hipCircumference;

  /// Longueur dos / Back length
  double? backLength;

  /// Longueur manche / Sleeve length
  double? sleeveLength;

  /// Longueur jambe (entrejambe) / Inseam length
  double? inseamLength;

  /// Tour de cou / Neck circumference
  double? neckCircumference;

  /// Carrure / Shoulder width
  double? shoulderWidth;

  // ===== Additional Measurements =====

  /// Longueur totale (hauteur) / Total height
  double? totalHeight;

  /// Tour de bras / Arm circumference
  double? armCircumference;

  /// Longueur de la jupe / Skirt length
  double? skirtLength;

  /// Longueur du pantalon / Pants length
  double? pantsLength;

  // ===== Custom Measurements =====

  /// Custom measurements that don't fit the standard fields
  /// List of custom measurement entries
  List<CustomMeasurement> customMeasurements = [];

  // ===== Notes =====

  /// Notes about these measurements
  String? notes;

  // ===== Helper Methods =====

  /// Add a custom measurement
  void addCustomMeasurement(String name, double value) {
    // Remove existing measurement with same name
    customMeasurements.removeWhere((m) => m.name == name);
    // Add new measurement
    customMeasurements.add(
      CustomMeasurement()
        ..name = name
        ..value = value,
    );
  }

  /// Remove a custom measurement
  void removeCustomMeasurement(String name) {
    customMeasurements.removeWhere((m) => m.name == name);
  }

  /// Get custom measurement value by name
  double? getCustomMeasurement(String name) {
    try {
      return customMeasurements.firstWhere((m) => m.name == name).value;
    } catch (e) {
      return null;
    }
  }

  /// Check if this record has any measurements
  bool get isEmpty {
    return bustCircumference == null &&
        waistCircumference == null &&
        hipCircumference == null &&
        backLength == null &&
        sleeveLength == null &&
        inseamLength == null &&
        neckCircumference == null &&
        shoulderWidth == null &&
        totalHeight == null &&
        armCircumference == null &&
        skirtLength == null &&
        pantsLength == null &&
        customMeasurements.isEmpty;
  }

  /// Get all non-null standard measurements as a map
  @ignore
  Map<String, double> get standardMeasurements {
    final map = <String, double>{};
    if (bustCircumference != null) {
      map['tourPoitrine'] = bustCircumference!;
    }
    if (waistCircumference != null) {
      map['tourTaille'] = waistCircumference!;
    }
    if (hipCircumference != null) map['tourHanches'] = hipCircumference!;
    if (backLength != null) map['epauleGenou'] = backLength!;
    if (sleeveLength != null) map['sleeveLength'] = sleeveLength!;
    if (inseamLength != null) map['inseamLength'] = inseamLength!;
    if (neckCircumference != null) {
      map['tourCou'] = neckCircumference!;
    }
    if (shoulderWidth != null) map['tourEpaule'] = shoulderWidth!;
    if (totalHeight != null) map['longueurTotale'] = totalHeight!;
    if (armCircumference != null) map['armCircumference'] = armCircumference!;
    if (skirtLength != null) map['skirtLength'] = skirtLength!;
    if (pantsLength != null) map['tailleSol'] = pantsLength!;
    return map;
  }

  /// Create a record from a map of measurements (Unified 8-field keys)
  static MeasurementRecord fromMap(Map<String, double> map) {
    return MeasurementRecord()
      ..recordedDate = DateTime.now()
      ..neckCircumference = map['tourCou']
      ..shoulderWidth = map['tourEpaule']
      ..bustCircumference = map['tourPoitrine']
      ..waistCircumference = map['tourTaille']
      ..hipCircumference = map['tourHanches']
      ..totalHeight = map['longueurTotale']
      ..backLength = map['epauleGenou']
      ..inseamLength = map['tailleSol']
      ..notes = 'Enregistré via Commande';
  }
}

/// Represents a custom measurement entry
///
/// Used to store measurements that don't fit standard fields
@embedded
class CustomMeasurement {
  /// Name of the measurement
  late String name;

  /// Value of the measurement in centimeters
  late double value;
}

/// Gender enum
enum Gender { male, female }
