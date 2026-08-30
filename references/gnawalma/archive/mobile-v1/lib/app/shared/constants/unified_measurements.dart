/// Unified measurement system for Gnawalma
///
/// 8 essential measurements used across:
/// - Client profiles
/// - Beneficiary profiles
/// - Order items (snapshots)
class UnifiedMeasurements {
  UnifiedMeasurements._();

  /// The 8 canonical measurement keys
  static const List<MeasurementField> fields = [
    // TOURS (Circumferences)
    MeasurementField(
      key: 'tourCou',
      labelFr: 'Tour de cou',
      icon: 'circle_outlined',
      category: MeasurementCategory.tours,
      min: 25,
      max: 65,
    ),
    MeasurementField(
      key: 'tourEpaule',
      labelFr: 'Tour d\'épaule',
      icon: 'accessibility_new',
      category: MeasurementCategory.tours,
      min: 30,
      max: 80,
    ),
    MeasurementField(
      key: 'tourPoitrine',
      labelFr: 'Tour de poitrine',
      icon: 'favorite_border',
      category: MeasurementCategory.tours,
      min: 60,
      max: 180,
    ),
    MeasurementField(
      key: 'tourTaille',
      labelFr: 'Tour de taille',
      icon: 'radio_button_unchecked',
      category: MeasurementCategory.tours,
      min: 50,
      max: 180,
    ),
    MeasurementField(
      key: 'tourHanches',
      labelFr: 'Tour de hanches',
      icon: 'panorama_horizontal_select',
      category: MeasurementCategory.tours,
      min: 70,
      max: 200,
    ),

    // LONGUEURS (Lengths)
    MeasurementField(
      key: 'longueurTotale',
      labelFr: 'Longueur totale',
      icon: 'height',
      category: MeasurementCategory.longueurs,
      helperText: 'Épaule au sol',
      min: 80,
      max: 220,
    ),
    MeasurementField(
      key: 'epauleGenou',
      labelFr: 'Épaule à genou',
      icon: 'straighten',
      category: MeasurementCategory.longueurs,
      min: 40,
      max: 150,
    ),
    MeasurementField(
      key: 'tailleSol',
      labelFr: 'Taille au sol',
      icon: 'vertical_align_bottom',
      category: MeasurementCategory.longueurs,
      helperText: 'Taille à plante des pieds',
      min: 60,
      max: 160,
    ),
  ];

  /// Get tours (circumference) measurements only
  static List<MeasurementField> get tours =>
      fields.where((f) => f.category == MeasurementCategory.tours).toList();

  /// Get longueurs (length) measurements only
  static List<MeasurementField> get longueurs =>
      fields.where((f) => f.category == MeasurementCategory.longueurs).toList();

  /// Convert a map to the 8-field format
  static Map<String, double?> fromMap(Map<String, dynamic> map) {
    return {
      for (final field in fields)
        field.key: map[field.key] as double? ?? map[field.labelFr] as double?,
    };
  }

  /// Convert 8-field format to display map
  static Map<String, double> toDisplayMap(Map<String, double?> measurements) {
    final result = <String, double>{};
    for (final field in fields) {
      final value = measurements[field.key];
      if (value != null) {
        result[field.labelFr] = value;
      }
    }
    return result;
  }
}

/// Single measurement field definition
class MeasurementField {
  final String key;
  final String labelFr;
  final String icon;
  final MeasurementCategory category;
  final String? helperText;
  final double min;
  final double max;

  const MeasurementField({
    required this.key,
    required this.labelFr,
    required this.icon,
    required this.category,
    this.helperText,
    required this.min,
    required this.max,
  });
}

/// Measurement categories
enum MeasurementCategory {
  /// Circumference measurements (tours)
  tours,

  /// Length measurements (longueurs)
  longueurs,
}
