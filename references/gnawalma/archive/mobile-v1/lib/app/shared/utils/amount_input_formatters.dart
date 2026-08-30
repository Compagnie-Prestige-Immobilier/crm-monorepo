import 'package:flutter/services.dart';

/// Input rules for the FCFA amount fields.
///
/// A tailor writes forty-five thousand as `45 000`, and a paste from a message
/// arrives with a non-breaking space or a currency suffix. `digitsOnly`
/// swallowed those without a word, so the field showed a number the user had
/// not typed. Everything is accepted on the way in and re-emitted grouped;
/// `AppNumbers` strips the separators again before parsing.
const List<TextInputFormatter> amountInputFormatters = [
  GroupedAmountInputFormatter(),
];

/// Regroups the digits by three as they are typed, keeping the caret on the
/// same digit it was on before the regrouping.
class GroupedAmountInputFormatter extends TextInputFormatter {
  const GroupedAmountInputFormatter();

  static const String separator = ' ';
  static final RegExp _nonDigits = RegExp(r'[^0-9]');

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final caret = newValue.selection.end.clamp(0, newValue.text.length);
    var digits = newValue.text.replaceAll(_nonDigits, '');
    var digitsBeforeCaret = newValue.text
        .substring(0, caret)
        .replaceAll(_nonDigits, '')
        .length;

    // Backspacing onto a separator has to take the digit it guards with it,
    // otherwise the separator reappears and the key looks broken.
    final removedSeparatorOnly =
        oldValue.text.length == newValue.text.length + 1 &&
        digits.length == oldValue.text.replaceAll(_nonDigits, '').length;
    if (removedSeparatorOnly && digitsBeforeCaret > 0) {
      digits =
          digits.substring(0, digitsBeforeCaret - 1) +
          digits.substring(digitsBeforeCaret);
      digitsBeforeCaret -= 1;
    }

    if (digits.isEmpty) return TextEditingValue.empty;

    final grouped = _group(digits);
    var offset = 0;
    var seen = 0;
    while (offset < grouped.length && seen < digitsBeforeCaret) {
      if (grouped[offset] != separator) seen++;
      offset++;
    }

    return TextEditingValue(
      text: grouped,
      selection: TextSelection.collapsed(offset: offset),
    );
  }

  static String _group(String digits) {
    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i != 0 && (digits.length - i) % 3 == 0) buffer.write(separator);
      buffer.write(digits[i]);
    }
    return buffer.toString();
  }
}
