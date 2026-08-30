import 'package:flutter_test/flutter_test.dart';
import 'package:gnawalma/ui.dart';

void main() {
  test('téléphone : masque, E.164, affichage', () {
    expect(formatPhone('771234567'), '77 123 45 67');
    expect(formatPhone('+221 77 123 45 67'), '77 123 45 67');
    expect(formatPhone('00221771234567'), '77 123 45 67');
    expect(formatPhone('7712'), '77 12');
    expect(phoneE164('77 123 45 67'), '+221771234567');
    expect(phoneE164(''), null);
    expect(prettyPhone('+221707867529'), '+221 70 786 75 29');
    expect(prettyPhone('+33612345678'), '+33612345678');
  });

  test('téléphone : validation sénégalaise', () {
    expect(phoneError('77 123 45 67'), null);
    expect(phoneError('33 823 45 67'), null);
    expect(phoneError('78 170 76'), isNotNull);
    expect(phoneError('12 345 67 89'), isNotNull);
    expect(phoneError(''), isNotNull);
    expect(phoneError('', required: false), null);
  });

  test('e-mail', () {
    expect(emailError('a@b.sn'), null);
    expect(emailError('pas-un-mail@'), isNotNull);
  });

  test('durée d\'une note vocale en m:ss', () {
    expect(formatClock(Duration.zero), '0:00');
    expect(formatClock(const Duration(seconds: 9)), '0:09');
    expect(formatClock(const Duration(seconds: 60)), '1:00');
    expect(formatClock(const Duration(seconds: 47, milliseconds: 900)), '0:47');
    expect(formatClock(const Duration(seconds: -5)), '0:00');
  });

  test('réseaux sociaux : nom seul', () {
    expect(socialHandle('@atelier.ndiaye'), 'atelier.ndiaye');
    expect(socialHandle('https://www.tiktok.com/@atelier.ndiaye?lang=fr'), 'atelier.ndiaye');
    expect(socialHandle('instagram.com/atelier/'), 'atelier');
    expect(socialUrl('tiktok', '@x'), 'https://www.tiktok.com/@x');
  });
}
