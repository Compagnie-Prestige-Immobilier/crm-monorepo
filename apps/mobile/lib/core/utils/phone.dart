library;

import 'package:phone_numbers_parser/phone_numbers_parser.dart';

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
  const PhoneInvalid(this.reason, {this.international = false});

  final PhoneProblem reason;

  /// Le numéro s'annonce d'un autre pays : la longueur sénégalaise n'a plus
  /// rien à lui reprocher.
  final bool international;

  String get message => switch (reason) {
    PhoneProblem.empty => 'Le numéro est obligatoire.',
    PhoneProblem.tooShort =>
      international
          ? 'Numéro incomplet.'
          : 'Numéro incomplet : 9 chiffres attendus.',
    PhoneProblem.tooLong =>
      international
          ? 'Numéro trop long.'
          : 'Numéro trop long : 9 chiffres attendus.',
    PhoneProblem.notDigits => 'Le numéro ne doit contenir que des chiffres.',
  };
}

enum PhoneProblem { empty, tooShort, tooLong, notDigits }

/// Bornes d'un numéro écrit à l'internationale (E.164) : de quoi refuser une
/// coquille sans prétendre connaître le plan de numérotation de chaque pays.
const int kInternationalMinDigits = 7;
const int kInternationalMaxDigits = 15;

abstract final class Phone {
  /// L'utilisateur annonce un autre pays : « + » ou « 00 » en tête. Ni la
  /// longueur ni le découpage sénégalais ne s'appliquent alors.
  static bool isInternational(String raw) {
    final String t = raw.trimLeft();
    return t.startsWith('+') || t.startsWith('00');
  }

  /// Le numéro tel qu'il est MONTRÉ, indicatif compris.
  ///
  /// Le champ garde « +221 » dans son décor et non dans son texte ; le
  /// registre, lui, écrit ce que l'accueil a lu (`visites.service.ts` garde le
  /// numéro tel quel).
  static String displayed(String text) {
    final String t = text.trim();
    if (t.isEmpty) return '';
    if (isInternational(t)) return t;
    return '+$kSenegalCallingCode $t';
  }

  /// L'inverse de [displayed] : ce qu'il faut remettre DANS le champ. Un
  /// numéro sénégalais y revient en national et regroupé, un numéro étranger
  /// tel qu'il a été écrit.
  static String editable(String stored) {
    final String t = stored.trim();
    if (t.isEmpty) return '';
    final String compact = _compact(t);
    if (compact.startsWith(kSenegalCallingCode) &&
        compact.length == kSenegalCallingCode.length + kSenegalNationalLength) {
      return groupNational(compact.substring(kSenegalCallingCode.length));
    }
    if (!isInternational(t) && compact.length <= kSenegalNationalLength) {
      return groupNational(compact);
    }
    return t;
  }

  static String _compact(String raw) {
    String compact = raw.replaceAll(_separators, '');
    if (compact.startsWith('+')) {
      compact = compact.substring(1);
    } else if (compact.startsWith('00')) {
      compact = compact.substring(2);
    }
    return compact.replaceAll(RegExp(r'[^0-9]'), '');
  }

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

  /// [strictSenegal] à faux accepte un numéro d'un autre pays, à la seule
  /// condition qu'il s'annonce comme tel (« + » ou « 00 ») : le Sénégal reste
  /// la règle par défaut, il n'est plus la seule.
  static PhoneResult parse(String raw, {bool strictSenegal = true}) {
    if (raw.trim().isEmpty) return const PhoneInvalid(PhoneProblem.empty);
    if (RegExp(r'[a-zA-Z]').hasMatch(raw)) {
      return const PhoneInvalid(PhoneProblem.notDigits);
    }
    if (!strictSenegal && isInternational(raw)) {
      final String compact = _compact(raw);
      if (compact.length < kInternationalMinDigits) {
        return const PhoneInvalid(PhoneProblem.tooShort, international: true);
      }
      if (compact.length > kInternationalMaxDigits) {
        return const PhoneInvalid(PhoneProblem.tooLong, international: true);
      }
      return PhoneValid('+$compact', compact);
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

/// Le numéro d'un pays QUELCONQUE : celui d'un prospect de la diaspora, son
/// WhatsApp.
///
/// [Phone] ne connaît que le plan sénégalais — neuf chiffres, découpage
/// 2-3-2-2 — et acceptait tout ce qui commençait par « + » sans rien en savoir.
/// Ici le plan de numérotation vient de `phone_numbers_parser`, ce qui donne la
/// mise en forme du pays et une validation qui refuse un numéro incomplet.
abstract final class WorldPhone {
  /// [callingCode] est l'indicatif SANS le « + », tel que le référentiel `pays`
  /// le porte. Un texte qui commence par « + » ou « 00 » le remplace : ce que
  /// l'utilisateur annonce prime sur le pays choisi dans la liste.
  static PhoneNumber? _parse(String raw, String callingCode) {
    final String texte = raw.trim();
    if (texte.isEmpty) return null;
    final String digits = texte.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return null;
    final String sujet = Phone.isInternational(texte)
        ? '+$digits'
        : '+$callingCode$digits';
    try {
      return PhoneNumber.parse(sujet);
    } on Object {
      return null;
    }
  }

  /// L'E.164 d'un numéro COMPLET pour son pays, `null` sinon : un numéro tronqué
  /// est indiscernable d'un numéro juste tant qu'on ne connaît pas le plan.
  static String? toE164(String raw, {required String callingCode}) {
    final PhoneNumber? numero = _parse(raw, callingCode);
    if (numero == null || !numero.isValid()) return null;
    return numero.international;
  }

  /// Le découpage du pays, au fil de la frappe.
  static String group(String digits, {required String callingCode}) {
    if (digits.isEmpty) return '';
    final PhoneNumber? numero = _parse(digits, callingCode);
    if (numero == null) return digits;
    final String formate = numero.formatNsn();
    // `formatNsn` peut RÉINTERPRÉTER les premiers chiffres comme un indicatif
    // (un « 1 » de tête en plan nord-américain) et rendre moins de chiffres
    // qu'il n'en a reçu : la frappe serait mangée.
    return formate.replaceAll(RegExp(r'[^0-9]'), '') == digits
        ? formate
        : digits;
  }
}
