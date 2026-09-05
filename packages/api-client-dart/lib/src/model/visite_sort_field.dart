//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum VisiteSortField {
  @JsonValue(r'visitedAt')
  visitedAt(r'visitedAt'),
  @JsonValue(r'visitorName')
  visitorName(r'visitorName'),
  @JsonValue(r'entreprise')
  entreprise(r'entreprise'),
  @JsonValue(r'direction')
  direction(r'direction'),
  @JsonValue(r'destinataire')
  destinataire(r'destinataire'),
  @JsonValue(r'objet')
  objet(r'objet'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const VisiteSortField(this.value);

  final String value;

  @override
  String toString() => value;
}
