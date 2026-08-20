import 'package:cpi_go/ui/widgets/phone_field.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Le formateur du champ téléphone.
///
/// Il regroupe en 2-3-2-2 à chaque frappe. Les espaces qu'il pose ne sont pas
/// saisis par l'utilisateur, et c'est là que se joue le retour arrière.
void main() {
  const SenegalPhoneFormatter formatter = SenegalPhoneFormatter();

  TextEditingValue format(String before, int cursorBefore, String after, int cursor) {
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
    expect(format('77 123 45 67', 12, '77 123 45 678', 13).text, '77 123 45 67');
  });

  test('un retour arrière sur un chiffre le supprime', () {
    final TextEditingValue out = format('77 123 45 67', 12, '77 123 45 6', 11);
    expect(out.text, '77 123 45 6');
    expect(out.selection.baseOffset, 11);
  });

  // Le regroupement replaçait l'espace aussitôt : le premier appui ne supprimait
  // rien et il en fallait deux pour avancer d'un chiffre.
  test('un retour arrière sur un espace supprime le chiffre qui le précède', () {
    final TextEditingValue out = format('77 123 45 67', 3, '77123 45 67', 2);
    expect(out.text, '71 234 56 7');
    expect(out.selection.baseOffset, 1);
  });
}
