import 'package:cpi_go/core/utils/whatsapp.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('waLink', () {
    test('retire le + du numéro, WhatsApp le refuse dans le lien', () {
      expect(waLink('+221771234567'), 'https://wa.me/221771234567');
    });

    test('un message facultatif se glisse en paramètre encodé', () {
      expect(
        waLink('+221771234567', 'Bonjour Fatou'),
        'https://wa.me/221771234567?text=Bonjour%20Fatou',
      );
    });
  });

  group('rendreMessageWhatsapp', () {
    test('remplace chaque jeton connu par sa valeur', () {
      expect(
        rendreMessageWhatsapp('Bonjour {prenom}, contactez {teleconseiller}.', <String, String>{
          'prenom': 'Fatou',
          'teleconseiller': 'Awa Diop',
        }),
        'Bonjour Fatou, contactez Awa Diop.',
      );
    });

    test('un jeton sans valeur reste affiché tel quel, pas de blanc muet', () {
      expect(
        rendreMessageWhatsapp('Lien : {lien}', <String, String>{'lien': ''}),
        'Lien : ',
      );
      expect(
        rendreMessageWhatsapp('Lien : {lien}', <String, String>{}),
        'Lien : {lien}',
      );
    });
  });
}
