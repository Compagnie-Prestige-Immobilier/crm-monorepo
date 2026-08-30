import 'package:flutter_test/flutter_test.dart';
import 'package:gnawalma/api.dart';
import 'package:gnawalma/router.dart';
import 'package:gnawalma/session.dart';

void main() {
  test('version minimale : comparaison', () {
    expect(versionBelow('1.9.9', '2.0.0'), true);
    expect(versionBelow('2.0.0', '2.0.0'), false);
    expect(versionBelow('2.0.1', '2.0.0'), false);
    expect(versionBelow('2.1', '2.0.9'), false);
    expect(versionBelow('2.0.0+7', '2.0.1'), true);
    expect(versionBelow('10.0.0', '9.9.9'), false);
    expect(versionBelow('', '2.0.0'), true);
  });

  test('contact invité : encodage et relecture', () {
    final at = DateTime(2026, 8, 26, 14, 30);
    final entry = '12|phone|${at.toIso8601String()}';
    final parsed = parsePendingContact(entry);
    expect(parsed?.atelierId, 12);
    expect(parsed?.channel, 'phone');
    expect(parsed?.at, at);
    expect(parsePendingContact('abc|phone|${at.toIso8601String()}'), null);
    expect(parsePendingContact('12|phone'), null);
    expect(parsePendingContact('12||${at.toIso8601String()}'), null);
    expect(parsePendingContact('12|phone|pas-une-date'), null);
  });

  test('lien profond : fiche atelier et réinitialisation', () {
    expect(deepLinkPath(Uri.parse('https://gnawalma.sn/a/12')), '/client/ateliers/12');
    expect(deepLinkPath(Uri.parse('gnawalma://atelier/12')), '/client/ateliers/12');
    expect(deepLinkPath(Uri.parse('https://gnawalma.sn/a/abc')), null);
    expect(deepLinkPath(Uri.parse('https://gnawalma.sn/a/')), null);
    expect(deepLinkPath(Uri.parse('https://gnawalma.sn/a/12/extra')), null);
    expect(deepLinkPath(Uri.parse('https://gnawalma.sn/reinitialiser?token=x&email=a%40b.sn')), '/reinitialiser?token=x&email=a%40b.sn');
    expect(deepLinkPath(Uri.parse('gnawalma://reinitialiser')), '/reinitialiser');
    expect(deepLinkPath(Uri.parse('https://gnawalma.sn/autre')), null);
  });

  test('lien profond : identifiant hors bornes rejeté à la route', () {
    final path = deepLinkPath(Uri.parse('https://gnawalma.sn/a/99999999999999999999999'));
    expect(int.tryParse(path!.split('/').last), null);
  });
}
