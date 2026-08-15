import 'package:cpi_go/core/utils/phone.dart';
import 'package:flutter_test/flutter_test.dart';

/// Normalisation du téléphone.
///
/// ═══ LE DÉFAUT QUE CE FICHIER INTERDIT DE REVENIR ═══
///
/// `kSenegalPrefixes` était une liste blanche **bloquante** de neuf entrées :
/// un préfixe absent rendait `toE164()` nul, donc `_canSave` faux, donc le
/// commercial ne pouvait PHYSIQUEMENT pas enregistrer le prospect. L'ARTP ouvre
/// des tranches (76 en 2016, 75 en 2019) ; le jour de la prochaine, la seule
/// issue aurait été un APK poussé par 2G à des gens en tournée.
///
/// Le serveur (`apps/api/src/common/phone.ts`, `libphonenumber-js`) est
/// l'autorité que le doc-comment de `phone.dart` nomme déjà.
void main() {
  group('préfixe inconnu', () {
    test('un préfixe hors liste reste ENREGISTRABLE', () {
      // Tranche fictive « 79 » : exactement ce que l'ARTP peut ouvrir demain.
      expect(Phone.toE164('79 123 45 67'), '+221791234567');
    });

    test('il est signalé, sans bloquer', () {
      final PhoneResult parsed = Phone.parse('79 123 45 67');
      expect(parsed, isA<PhoneValid>());
      final PhoneValid valid = parsed as PhoneValid;
      expect(valid.warning, PhoneWarning.unknownPrefix);
      expect(valid.warningMessage, isNotNull);
    });

    test('un préfixe connu ne porte aucune réserve', () {
      final PhoneValid valid = Phone.parse('77 123 45 67') as PhoneValid;
      expect(valid.warning, isNull);
      expect(valid.warningMessage, isNull);
      expect(valid.e164, '+221771234567');
    });
  });

  group('ce qui reste vraiment invalide', () {
    test('trop court', () {
      expect(Phone.parse('77 12'), isA<PhoneInvalid>());
      expect(Phone.toE164('77 12'), isNull);
    });

    test('trop long', () {
      expect(
        (Phone.parse('77 123 45 67 8') as PhoneInvalid).reason,
        PhoneProblem.tooLong,
      );
    });

    test('des lettres', () {
      expect(
        (Phone.parse('77 abc 45 67') as PhoneInvalid).reason,
        PhoneProblem.notDigits,
      );
    });

    test('vide', () {
      expect((Phone.parse('   ') as PhoneInvalid).reason, PhoneProblem.empty);
    });
  });

  group('convergence des écritures', () {
    test('les quatre formes du même abonné donnent la même clé', () {
      // La déduplication repose là-dessus : si deux écritures d'un même numéro
      // divergent, l'index unique ne contraint plus rien.
      const String expected = '+221771234567';
      for (final String raw in <String>[
        '771234567',
        '77 123 45 67',
        '+221 77 123 45 67',
        '00221771234567',
      ]) {
        expect(Phone.toE164(raw), expected, reason: raw);
      }
    });

    test('un national qui commence comme l\'indicatif n\'est pas amputé', () {
      // `221…` en tête d'un numéro national de 9 chiffres ne doit pas être pris
      // pour l'indicatif pays.
      expect(Phone.digitsOf('221234567'), '221234567');
    });
  });
}
