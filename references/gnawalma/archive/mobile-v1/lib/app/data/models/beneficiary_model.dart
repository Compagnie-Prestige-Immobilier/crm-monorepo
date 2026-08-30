import 'package:isar_plus/isar_plus.dart';

part 'beneficiary_model.g.dart';

/// Represents a beneficiary (family member) linked to a client
///
/// A beneficiary:
/// - Belongs to a client (the payer)
/// - Has a label (e.g., "Époux", "Enfant 1", "Neveu")
/// - Can have saved measurements (optional)
/// - Can have multiple orders/projects
@collection
class BeneficiaryModel {
  int id = 0;

  // ===== Relationship =====

  /// ID of the client this beneficiary belongs to
  @Index()
  late int clientId;

  // ===== Identification =====

  /// Display label for this beneficiary (e.g., "Époux", "Enfant 1", "Ma sœur")
  /// Not a real name - just how the tailor remembers them
  late String label;

  /// Gender of the beneficiary
  late BeneficiaryGender gender;

  // ===== Measurements (Optional) =====
  /// If saved, these can be pre-filled for future orders
  /// Using the unified 8-field measurement system

  /// Tour de cou / Neck circumference
  double? tourCou;

  /// Tour d'épaule / Shoulder circumference
  double? tourEpaule;

  /// Tour de poitrine / Bust circumference
  double? tourPoitrine;

  /// Tour de taille / Waist circumference
  double? tourTaille;

  /// Tour de hanches / Hip circumference
  double? tourHanches;

  /// Longueur totale / Total length (shoulder to floor)
  double? longueurTotale;

  /// Épaule à genou / Shoulder to knee
  double? epauleGenou;

  /// Taille au sol / Waist to floor
  double? tailleSol;

  // ===== Tracking =====

  /// When this beneficiary was added
  late DateTime createdAt;

  /// When measurements were last updated
  DateTime? measurementsUpdatedAt;

  // ===== Notes =====

  /// Optional notes about this beneficiary
  String? notes;

  // ===== Helper Methods =====

  /// Check if this beneficiary has any saved measurements
  bool get hasMeasurements {
    return tourCou != null ||
        tourEpaule != null ||
        tourPoitrine != null ||
        tourTaille != null ||
        tourHanches != null ||
        longueurTotale != null ||
        epauleGenou != null ||
        tailleSol != null;
  }

  /// Get measurements as a map (for display/snapshot)
  @ignore
  Map<String, double> get measurementsMap {
    final map = <String, double>{};
    if (tourCou != null) map['tourCou'] = tourCou!;
    if (tourEpaule != null) map['tourEpaule'] = tourEpaule!;
    if (tourPoitrine != null) map['tourPoitrine'] = tourPoitrine!;
    if (tourTaille != null) map['tourTaille'] = tourTaille!;
    if (tourHanches != null) map['tourHanches'] = tourHanches!;
    if (longueurTotale != null) map['longueurTotale'] = longueurTotale!;
    if (epauleGenou != null) map['epauleGenou'] = epauleGenou!;
    if (tailleSol != null) map['tailleSol'] = tailleSol!;
    return map;
  }

  /// Set measurements from a map (Unified 8-field keys)
  void setMeasurementsFromMap(Map<String, double> map) {
    tourCou = map['tourCou'];
    tourEpaule = map['tourEpaule'];
    tourPoitrine = map['tourPoitrine'];
    tourTaille = map['tourTaille'];
    tourHanches = map['tourHanches'];
    longueurTotale = map['longueurTotale'];
    epauleGenou = map['epauleGenou'];
    tailleSol = map['tailleSol'];
    measurementsUpdatedAt = DateTime.now();
  }

  /// Get display icon based on gender
  String get genderIcon {
    switch (gender) {
      case BeneficiaryGender.male:
        return '👨';
      case BeneficiaryGender.female:
        return '👩';
      case BeneficiaryGender.child:
        return '👧';
    }
  }
}

/// Gender for beneficiaries
enum BeneficiaryGender {
  /// Male (Homme)
  male,

  /// Female (Femme)
  female,

  /// Child (Enfant) - gender neutral for children
  child,
}
