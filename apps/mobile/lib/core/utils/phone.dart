library;

const String kSenegalCallingCode = '221';

const int kSenegalNationalLength = 9;

const Set<String> kSenegalPrefixes = <String>{
  '70', '75', '76', '77', '78', // mobiles
  '30', '32', '33', '39', // fixes
};

final RegExp _separators = RegExp(r'[\s.\-()‐-―/]');

sealed class PhoneResult {
  const PhoneResult();
}

class PhoneValid extends PhoneResult {
  const PhoneValid(this.e164, this.national, {this.warning});

  final String e164;

  final String national;

  final PhoneWarning? warning;

  String? get warningMessage => switch (warning) {
    PhoneWarning.unknownPrefix =>
      'Préfixe inhabituel : vérifiez le numéro. Il sera enregistré.',
    null => null,
  };
}

enum PhoneWarning { unknownPrefix }

class PhoneInvalid extends PhoneResult {
  const PhoneInvalid(this.reason);

  final PhoneProblem reason;

  String get message => switch (reason) {
    PhoneProblem.empty => 'Le numéro est obligatoire.',
    PhoneProblem.tooShort => 'Numéro incomplet : 9 chiffres attendus.',
    PhoneProblem.tooLong => 'Numéro trop long : 9 chiffres attendus.',
    PhoneProblem.notDigits => 'Le numéro ne doit contenir que des chiffres.',
  };
}

enum PhoneProblem { empty, tooShort, tooLong, notDigits }

abstract final class Phone {
  static String digitsOf(String raw) {
    String compact = raw.replaceAll(_separators, '');
    if (compact.startsWith('+')) {
      compact = compact.substring(1);
    } else if (compact.startsWith('00')) {
      compact = compact.substring(2);
    }
    compact = compact.replaceAll(RegExp(r'[^0-9]'), '');

    if (compact.startsWith(kSenegalCallingCode) &&
        compact.length > kSenegalNationalLength) {
      final String national = compact.substring(kSenegalCallingCode.length);
      if (national.length == kSenegalNationalLength) return national;
    }
    return compact;
  }

  static PhoneResult parse(String raw) {
    if (raw.trim().isEmpty) return const PhoneInvalid(PhoneProblem.empty);
    if (RegExp(r'[a-zA-Z]').hasMatch(raw)) {
      return const PhoneInvalid(PhoneProblem.notDigits);
    }
    final String digits = digitsOf(raw);
    if (digits.length < kSenegalNationalLength) {
      return const PhoneInvalid(PhoneProblem.tooShort);
    }
    if (digits.length > kSenegalNationalLength) {
      return const PhoneInvalid(PhoneProblem.tooLong);
    }
    final bool known = kSenegalPrefixes.contains(digits.substring(0, 2));
    return PhoneValid(
      '+$kSenegalCallingCode$digits',
      digits,
      warning: known ? null : PhoneWarning.unknownPrefix,
    );
  }

  static String? toE164(String raw) {
    final PhoneResult result = parse(raw);
    return result is PhoneValid ? result.e164 : null;
  }

  static String format(String e164OrRaw) {
    final String d = digitsOf(e164OrRaw);
    if (d.length != kSenegalNationalLength) return e164OrRaw;
    return '+$kSenegalCallingCode ${d.substring(0, 2)} ${d.substring(2, 5)} '
        '${d.substring(5, 7)} ${d.substring(7, 9)}';
  }

  static String groupNational(String digits) {
    final StringBuffer out = StringBuffer();
    for (int i = 0; i < digits.length && i < kSenegalNationalLength; i++) {
      if (i == 2 || i == 5 || i == 7) out.write(' ');
      out.write(digits[i]);
    }
    return out.toString();
  }
}
