//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum RepresentantRelation {
  @JsonValue(r'INCONNU')
  INCONNU(r'INCONNU'),
  @JsonValue(r'CONTACTE')
  CONTACTE(r'CONTACTE'),
  @JsonValue(r'AMBASSADEUR')
  AMBASSADEUR(r'AMBASSADEUR'),
  @JsonValue(r'REFUS')
  REFUS(r'REFUS'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const RepresentantRelation(this.value);

  final String value;

  @override
  String toString() => value;
}
