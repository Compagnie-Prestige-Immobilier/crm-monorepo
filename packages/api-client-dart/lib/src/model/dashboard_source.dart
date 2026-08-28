//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum DashboardSource {
  @JsonValue(r'total-visites')
  totalVisites(r'total-visites'),
  @JsonValue(r'moyenne-journaliere')
  moyenneJournaliere(r'moyenne-journaliere'),
  @JsonValue(r'jour-le-plus-charge')
  jourLePlusCharge(r'jour-le-plus-charge'),
  @JsonValue(r'par-entreprise')
  parEntreprise(r'par-entreprise'),
  @JsonValue(r'par-objet')
  parObjet(r'par-objet'),
  @JsonValue(r'par-direction')
  parDirection(r'par-direction'),
  @JsonValue(r'par-destinataire')
  parDestinataire(r'par-destinataire'),
  @JsonValue(r'par-jour')
  parJour(r'par-jour'),
  @JsonValue(r'par-mois')
  parMois(r'par-mois'),
  @JsonValue(r'par-heure')
  parHeure(r'par-heure'),
  @JsonValue(r'par-jour-semaine')
  parJourSemaine(r'par-jour-semaine'),
  @JsonValue(r'par-heure-jour-semaine')
  parHeureJourSemaine(r'par-heure-jour-semaine'),
  @JsonValue(r'par-agent')
  parAgent(r'par-agent'),
  @JsonValue(r'par-entreprise-objet')
  parEntrepriseObjet(r'par-entreprise-objet'),
  @JsonValue(r'par-destinataire-direction')
  parDestinataireDirection(r'par-destinataire-direction'),
  @JsonValue(r'par-objet-mois')
  parObjetMois(r'par-objet-mois'),
  @JsonValue(r'visiteurs-recurrents')
  visiteursRecurrents(r'visiteurs-recurrents'),
  @JsonValue(r'avec-telephone')
  avecTelephone(r'avec-telephone'),
  @JsonValue(r'qualite-de-saisie')
  qualiteDeSaisie(r'qualite-de-saisie'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const DashboardSource(this.value);

  final String value;

  @override
  String toString() => value;
}
