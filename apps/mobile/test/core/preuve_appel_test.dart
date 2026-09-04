import 'package:cpi_go/core/telephonie/preuve_appel.dart';
import 'package:cpi_go/core/telephonie/telephonie_port.dart';
import 'package:flutter_test/flutter_test.dart';

/// La preuve d'appel est ce qui distingue « il dit avoir appelé » de « le
/// téléphone l'a fait ». Elle ne vaut donc que si elle refuse tout ce qui n'est
/// pas l'appel lancé : un autre numéro, un appel d'avant, une invention.
void main() {
  final DateTime lance = DateTime.utc(2026, 9, 4, 14, 0);

  EntreeJournal entree(
    String numero,
    DateTime at, {
    String type = 'sortant',
    int duree = 92,
  }) => EntreeJournal(type: type, at: at, dureeSecondes: duree, numero: numero);

  test('le numéro national du journal vaut l\'E.164 de la fiche', () {
    final EntreeJournal ligne = entree('77 123 45 67', lance);

    expect(
      rapprocher(<EntreeJournal>[ligne], e164: '+221771234567', lanceA: lance),
      same(ligne),
    );
  });

  test('un préfixe international recomposé se rapproche aussi', () {
    final EntreeJournal ligne = entree('00221771234567', lance);

    expect(
      rapprocher(<EntreeJournal>[ligne], e164: '+221771234567', lanceA: lance),
      same(ligne),
    );
  });

  test('l\'appel d\'un AUTRE numéro n\'est jamais retourné', () {
    expect(
      rapprocher(
        <EntreeJournal>[entree('+221770000009', lance)],
        e164: '+221771234567',
        lanceA: lance,
      ),
      isNull,
    );
  });

  // L'entrée d'avant est l'appel PRÉCÉDENT vers la même personne : la rendre
  // ferait passer une durée d'hier pour la tentative qu'on saisit.
  test('une entrée antérieure au lancement est ignorée', () {
    expect(
      rapprocher(
        <EntreeJournal>[
          entree('+221771234567', lance.subtract(const Duration(minutes: 5))),
        ],
        e164: '+221771234567',
        lanceA: lance,
      ),
      isNull,
    );
  });

  test('la minute de marge couvre la dérive de l\'horloge du téléphone', () {
    final EntreeJournal ligne = entree(
      '+221771234567',
      lance.subtract(const Duration(seconds: 40)),
    );

    expect(
      rapprocher(<EntreeJournal>[ligne], e164: '+221771234567', lanceA: lance),
      same(ligne),
    );
  });

  test('la plus récente gagne quand le numéro a été appelé deux fois', () {
    final EntreeJournal ancienne = entree(
      '+221771234567',
      lance.add(const Duration(minutes: 1)),
    );
    final EntreeJournal recente = entree(
      '+221771234567',
      lance.add(const Duration(minutes: 9)),
    );

    expect(
      rapprocher(
        <EntreeJournal>[ancienne, recente],
        e164: '+221771234567',
        lanceA: lance,
      ),
      same(recente),
    );
  });

  test('le libellé dit le sens, la durée et l\'heure', () {
    expect(
      libellePreuve(
        type: 'sortant',
        dureeSecondes: 92,
        at: DateTime(2026, 9, 4, 14, 2),
      ),
      'Sortant · 1 min 32 · 14:02',
    );
    expect(
      libellePreuve(
        type: 'manque',
        dureeSecondes: 0,
        at: DateTime(2026, 9, 4, 9, 5),
      ),
      'Manqué · 0 s · 09:05',
    );
    expect(
      libellePreuve(
        type: 'sortant',
        dureeSecondes: 120,
        at: DateTime(2026, 9, 4, 9, 5),
      ),
      'Sortant · 2 min · 09:05',
    );
  });

  test('sans entrée de journal, le libellé l\'avoue', () {
    expect(libellePreuve(), 'Non confirmé par le téléphone');
    expect(
      libellePreuve(type: 'sortant', dureeSecondes: 12),
      'Non confirmé par le téléphone',
    );
  });

  // Le canal natif est un contrat, pas une promesse : un type hors vocabulaire
  // deviendrait une valeur que le serveur refuse.
  test('un type de journal hors contrat retombe sur « inconnu »', () {
    expect(
      EntreeJournal.fromMap(<Object?, Object?>{
        'type': 'VOICEMAIL',
        'at': lance.millisecondsSinceEpoch,
        'dureeSecondes': 3,
        'numero': '+221771234567',
      }).type,
      'inconnu',
    );
  });
}
