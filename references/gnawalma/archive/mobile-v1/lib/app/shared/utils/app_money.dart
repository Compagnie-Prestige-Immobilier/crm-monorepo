import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../modules/preferences/controllers/preferences_provider.dart';

/// Formats money according to the currency the user actually chose.
///
/// The currency preference used to be written to storage and read by nothing:
/// every amount in the app was a hardcoded `'… FCFA'` literal, so choosing EUR
/// changed a stored string and not one pixel. A setting the product ignores is
/// worse than no setting — it tells the user something is configurable when it
/// is not.
///
/// Amounts are grouped the way the interface writes them (`12 000`), which is
/// also the form [AppNumbers] accepts back on input, so what the app prints and
/// what it will parse stay symmetrical.
class MoneyFormatter {
  const MoneyFormatter({required this.currency, this.locale = 'fr'});

  final String currency;
  final String locale;

  /// Zero-decimal currencies. The CFA franc has no minor unit, so rendering
  /// `12 000,00 F` would be wrong rather than merely noisy.
  static const Set<String> _zeroDecimal = {'FCFA', 'XOF', 'XAF'};

  bool get _isZeroDecimal => _zeroDecimal.contains(currency.toUpperCase());

  /// `12 000 FCFA`. Pass [compactSymbol] for tight rows, giving `12 000 F`.
  String format(num? amount, {bool compactSymbol = false}) {
    final value = amount ?? 0;
    final pattern = NumberFormat.decimalPattern(locale)
      ..minimumFractionDigits = 0
      ..maximumFractionDigits = _isZeroDecimal ? 0 : 2;
    final symbol = compactSymbol ? _compactSymbol : currency;
    return '${pattern.format(value)} $symbol';
  }

  /// The number alone, for places that render their own unit.
  String formatAmount(num? amount) {
    final pattern = NumberFormat.decimalPattern(locale)
      ..minimumFractionDigits = 0
      ..maximumFractionDigits = _isZeroDecimal ? 0 : 2;
    return pattern.format(amount ?? 0);
  }

  String get _compactSymbol => switch (currency.toUpperCase()) {
    'FCFA' || 'XOF' || 'XAF' => 'F',
    'EUR' => '€',
    'USD' => r'$',
    _ => currency,
  };
}

/// The formatter bound to the stored preference. Watch it wherever money is
/// rendered so a currency change repaints every amount.
final moneyFormatterProvider = Provider<MoneyFormatter>((ref) {
  final prefs = ref.watch(preferencesProvider).value;
  return MoneyFormatter(currency: prefs?.selectedCurrency ?? 'FCFA');
});
