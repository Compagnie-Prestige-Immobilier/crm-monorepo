import 'package:cpi_go/ui/widgets/local_typeahead.dart';
import 'package:flutter_test/flutter_test.dart';

/// Recherche dans les référentiels — insensible à la casse ET aux accents.
///
/// Le défaut d'origine a été observé sur émulateur : taper « Thies » dans le
/// sélecteur de département ne remontait rien, alors que « Thi » trouvait
/// « Thiès ». Personne ne pose les accents en tapant vite sur un clavier de
/// téléphone ; le commercial en conclut que son département n'existe pas, et il
/// ne peut plus enregistrer sa fiche.
void main() {
  TypeaheadOption option(
    String label, {
    String? secondary,
    List<String> keywords = const <String>[],
  }) => TypeaheadOption(id: label, label: label, secondary: secondary, keywords: keywords);

  group('foldSearch', () {
    test('replie les accents des référentiels sénégalais', () {
      expect(foldSearch('Thiès'), 'thies');
      expect(foldSearch('Kédougou'), 'kedougou');
      expect(foldSearch('Sédhiou'), 'sedhiou');
      expect(foldSearch('Ndèye'), 'ndeye');
      expect(foldSearch('Aïssatou'), 'aissatou');
      expect(foldSearch('Coopérative'), 'cooperative');
    });

    test('laisse intact ce qui n’a pas de diacritique', () {
      expect(foldSearch('Dakar'), 'dakar');
      expect(foldSearch('CBAO'), 'cbao');
    });
  });

  group('matches — départements', () {
    final TypeaheadOption thies = option('Thiès', secondary: 'TH-THI');

    test('la saisie SANS accent trouve le libellé accentué', () {
      // Exactement le cas observé sur l'appareil.
      expect(thies.matches('Thies'), isTrue);
      expect(thies.matches('thies'), isTrue);
      expect(thies.matches('THIES'), isTrue);
    });

    test('la saisie AVEC accent continue de fonctionner', () {
      expect(thies.matches('Thiès'), isTrue);
      expect(thies.matches('thiès'), isTrue);
    });

    test('un préfixe partiel suffit', () {
      expect(thies.matches('Thi'), isTrue);
    });

    test('le code du département reste cherchable', () {
      expect(thies.matches('TH-THI'), isTrue);
      expect(thies.matches('th-thi'), isTrue);
    });

    test('un terme absent ne remonte rien', () {
      expect(thies.matches('Dakar'), isFalse);
    });

    test('Kédougou se trouve aussi sans accent', () {
      expect(option('Kédougou', secondary: 'KE-KED').matches('Kedougou'), isTrue);
    });
  });

  group('matches — mots-clés', () {
    test('le sigle d’un syndicat mord, accentué ou non', () {
      final TypeaheadOption chues = option(
        'Coopérative d’Habitat de l’Union des Enseignants du Sénégal',
        keywords: <String>['CHUES'],
      );
      expect(chues.matches('chues'), isTrue);
      expect(chues.matches('cooperative'), isTrue);
      expect(chues.matches('senegal'), isTrue);
    });
  });

  test('une requête vide laisse tout passer', () {
    expect(option('Thiès').matches(''), isTrue);
  });
}
