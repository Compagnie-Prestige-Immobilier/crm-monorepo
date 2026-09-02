import 'package:cpi_go/core/utils/phone.dart';
import 'package:cpi_go/ui/widgets/phone_field.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Le formateur du champ téléphone.
///
/// Il regroupe en 2-3-2-2 à chaque frappe. Les espaces qu'il pose ne sont pas
/// saisis par l'utilisateur, et c'est là que se joue le retour arrière.
void main() {
  const SenegalPhoneFormatter formatter = SenegalPhoneFormatter();

  TextEditingValue format(
    String before,
    int cursorBefore,
    String after,
    int cursor,
  ) {
    return formatter.formatEditUpdate(
      TextEditingValue(
        text: before,
        selection: TextSelection.collapsed(offset: cursorBefore),
      ),
      TextEditingValue(
        text: after,
        selection: TextSelection.collapsed(offset: cursor),
      ),
    );
  }

  test('la frappe regroupe au fil des chiffres', () {
    expect(format('77 123 4', 8, '77 123 45', 9).text, '77 123 45');
    expect(format('', 0, '771234567', 9).text, '77 123 45 67');
  });

  test('au-delà de neuf chiffres, la frappe est ignorée', () {
    expect(
      format('77 123 45 67', 12, '77 123 45 678', 13).text,
      '77 123 45 67',
    );
  });

  test('un retour arrière sur un chiffre le supprime', () {
    final TextEditingValue out = format('77 123 45 67', 12, '77 123 45 6', 11);
    expect(out.text, '77 123 45 6');
    expect(out.selection.baseOffset, 11);
  });

  // Le regroupement replaçait l'espace aussitôt : le premier appui ne supprimait
  // rien et il en fallait deux pour avancer d'un chiffre.
  test(
    'un retour arrière sur un espace supprime le chiffre qui le précède',
    () {
      final TextEditingValue out = format('77 123 45 67', 3, '77123 45 67', 2);
      expect(out.text, '71 234 56 7');
      expect(out.selection.baseOffset, 1);
    },
  );

  // Le prospect de la diaspora dicte un numéro qui n'est pas sénégalais. Le
  // champ strict lui coupait ses chiffres au neuvième et en enregistrait un
  // AUTRE, que le serveur refusait ensuite.
  group('le champ international', () {
    const WorldPhoneFormatter italie = WorldPhoneFormatter('39');

    String frappe(String digits) => italie
        .formatEditUpdate(
          TextEditingValue.empty,
          TextEditingValue(
            text: digits,
            selection: TextSelection.collapsed(offset: digits.length),
          ),
        )
        .text;

    test('un numéro italien se met en forme au fil de la frappe', () {
      expect(frappe('333'), '333');
      expect(frappe('3331234567'), '333 123 4567');
    });

    test('un numéro italien complet devient son E.164', () {
      expect(
        WorldPhone.toE164('333 123 4567', callingCode: '39'),
        '+393331234567',
      );
    });

    test('un numéro trop court pour son pays est refusé', () {
      expect(WorldPhone.toE164('333', callingCode: '39'), isNull);
      expect(WorldPhone.toE164('', callingCode: '39'), isNull);
    });

    // L'indicatif du décor ne s'applique qu'au numéro national : ce qui
    // s'annonce « + » porte déjà le sien.
    test('un numéro annoncé avec son indicatif prime sur celui choisi', () {
      expect(
        WorldPhone.toE164('+221 77 123 45 67', callingCode: '39'),
        '+221771234567',
      );
    });

    // Le plan nord-américain relit un « 1 » de tête comme son indicatif : la
    // mise en forme rendait alors moins de chiffres qu'elle n'en recevait.
    test('la mise en forme ne mange jamais un chiffre', () {
      const WorldPhoneFormatter usa = WorldPhoneFormatter('1');
      const String saisie = '12345678901';
      final String sortie = usa
          .formatEditUpdate(
            TextEditingValue.empty,
            const TextEditingValue(
              text: saisie,
              selection: TextSelection.collapsed(offset: saisie.length),
            ),
          )
          .text;
      expect(sortie.replaceAll(RegExp(r'[^0-9]'), ''), saisie);
    });
  });
}
