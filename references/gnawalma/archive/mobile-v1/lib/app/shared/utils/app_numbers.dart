/// Parsing for numbers as people actually type them.
///
/// Tailors write FCFA the way the language does — `12 000`, sometimes with a
/// non-breaking space from a paste, sometimes `12 500,50` with a decimal comma.
/// `double.tryParse` rejects every one of those, so a perfectly valid amount was
/// being reported back as "Montant invalide", and validity checks read it as 0.
///
/// The rule this encodes (Postel): accept anything the user could reasonably
/// mean, and normalise on the way in — never make them retype a number the app
/// could have understood.
class AppNumbers {
  AppNumbers._();

  /// Every space-like separator a grouped number picks up in the wild:
  /// plain, non-breaking, narrow non-breaking, thin.
  static final RegExp _separators = RegExp(r'[\s   ]');

  /// Anything that is not a digit, a sign, or a decimal mark — currency
  /// suffixes such as `F`, `FCFA`, `€` and stray dots used as group marks.
  static final RegExp _nonNumeric = RegExp(r'[^0-9,.\-]');

  /// Parses a user-entered number, or returns null when there is no number in
  /// it at all. Empty and whitespace-only input yields null, not 0, so callers
  /// can tell "left blank" apart from "typed zero".
  static double? tryParse(String? raw) {
    if (raw == null) return null;
    var value = raw.replaceAll(_separators, '').replaceAll(_nonNumeric, '');
    if (value.isEmpty || value == '-') return null;

    // With both marks present the last one is the decimal separator and the
    // other is a group mark: 1.234,56 and 1,234.56 both mean the same amount.
    final lastComma = value.lastIndexOf(',');
    final lastDot = value.lastIndexOf('.');
    if (lastComma != -1 && lastDot != -1) {
      final decimalAt = lastComma > lastDot ? lastComma : lastDot;
      final groupMark = lastComma > lastDot ? '.' : ',';
      value = value.replaceAll(groupMark, '');
      final shifted = value.lastIndexOf(decimalAt > lastDot ? ',' : '.');
      value = '${value.substring(0, shifted)}.${value.substring(shifted + 1)}';
    } else if (lastComma != -1) {
      value = value.replaceFirst(',', '.');
    }

    return double.tryParse(value);
  }

  /// Parses to a number, falling back to [fallback] (0 by default).
  static double parse(String? raw, {double fallback = 0}) =>
      tryParse(raw) ?? fallback;

  /// True when the field holds something that is not a usable number. Blank is
  /// not invalid — required-ness is a separate question from well-formedness.
  static bool isInvalid(String? raw) =>
      raw != null && raw.trim().isNotEmpty && tryParse(raw) == null;

  /// Compares two user-entered numbers for equality, so a dirty-check does not
  /// fire merely because `45000` was re-rendered as `45000.0`.
  static bool sameNumber(String? a, String? b) {
    final left = tryParse(a);
    final right = tryParse(b);
    if (left == null || right == null) return left == right;
    return (left - right).abs() < 0.0001;
  }
}
