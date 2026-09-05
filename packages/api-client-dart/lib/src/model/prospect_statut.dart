//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum ProspectStatut {
  @JsonValue(r'NOUVEAU')
  NOUVEAU(r'NOUVEAU'),
  @JsonValue(r'CONTACTE')
  CONTACTE(r'CONTACTE'),
  @JsonValue(r'CONVERTI')
  CONVERTI(r'CONVERTI'),
  @JsonValue(r'PERDU')
  PERDU(r'PERDU'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const ProspectStatut(this.value);

  final String value;

  @override
  String toString() => value;
}
