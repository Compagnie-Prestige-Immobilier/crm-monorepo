/// Utility to parse Senegalese tailoring shorthand.
///
/// Example: "TP 110 +2, TT 90, LB 120"
/// Result: { "tourPoitrine": 112.0, "tourTaille": 90.0, "longueurBoubou": 120.0 }
class ShorthandParser {
  static final Map<String, String> _mapping = {
    'TP': 'tourPoitrine',
    'TT': 'tourTaille',
    'TH': 'tourHanches',
    'LB': 'longueurBoubou',
    'LM': 'longueurManche',
    'LE': 'largeurEpaule',
    'TC': 'tourCou',
    'LG': 'longueurTotale',
    'EG': 'epauleGenou',
    'TS': 'tailleSol',
  };

  /// Parses a string into a map of measurement keys and double values.
  static Map<String, double> parse(String input) {
    final Map<String, double> results = {};
    if (input.isEmpty) return results;

    // Split by comma or space
    final parts = input.toUpperCase().split(RegExp(r'[, ]+'));

    String? lastKey;

    for (var part in parts) {
      // 1. Check if part is a known key (TP, TT, etc)
      if (_mapping.containsKey(part)) {
        lastKey = _mapping[part];
      }
      // 2. Check if part is a modifier (+2, +3)
      else if (part.startsWith('+') &&
          lastKey != null &&
          results.containsKey(lastKey)) {
        final modifier = double.tryParse(part.substring(1));
        if (modifier != null) {
          results[lastKey] = results[lastKey]! + modifier;
        }
      }
      // 3. Check if part is a pure number
      else {
        final value = double.tryParse(part.replaceAll(',', '.'));
        if (value != null && lastKey != null) {
          results[lastKey] = value;
          // Don't reset lastKey yet, might have a modifier following
        }
      }
    }

    return results;
  }

  /// Formats a measurements map back into a pretty string.
  static String formatPretty(Map<String, double> measurements) {
    if (measurements.isEmpty) return "Aucune mesure";

    final List<String> lines = [];
    final inverseMapping = _mapping.map((key, value) => MapEntry(value, key));

    measurements.forEach((key, value) {
      final shortKey = inverseMapping[key] ?? key;
      lines.add("$shortKey: ${value.toStringAsFixed(0)}cm");
    });

    return lines.join(" • ");
  }
}
