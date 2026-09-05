//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum Role {
  @JsonValue(r'ADMIN')
  ADMIN(r'ADMIN'),
  @JsonValue(r'COMMERCIAL')
  COMMERCIAL(r'COMMERCIAL'),
  @JsonValue(r'BANQUE_FINANCE')
  BANQUE_FINANCE(r'BANQUE_FINANCE'),
  @JsonValue(r'SUPERVISEUR')
  SUPERVISEUR(r'SUPERVISEUR'),
  @JsonValue(r'DIRECTION')
  DIRECTION(r'DIRECTION'),
  @JsonValue(r'ACCUEIL')
  ACCUEIL(r'ACCUEIL'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const Role(this.value);

  final String value;

  @override
  String toString() => value;
}
