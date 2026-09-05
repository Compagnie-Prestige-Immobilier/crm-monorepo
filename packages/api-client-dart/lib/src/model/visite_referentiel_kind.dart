//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum VisiteReferentielKind {
  @JsonValue(r'entreprises')
  entreprises(r'entreprises'),
  @JsonValue(r'directions')
  directions(r'directions'),
  @JsonValue(r'destinataires')
  destinataires(r'destinataires'),
  @JsonValue(r'objets')
  objets(r'objets'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const VisiteReferentielKind(this.value);

  final String value;

  @override
  String toString() => value;
}
