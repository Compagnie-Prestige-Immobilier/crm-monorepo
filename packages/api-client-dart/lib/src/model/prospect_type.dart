//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum ProspectType {
  @JsonValue(r'FONCTIONNAIRE')
  FONCTIONNAIRE(r'FONCTIONNAIRE'),
  @JsonValue(r'SECTEUR_PRIVE')
  SECTEUR_PRIVE(r'SECTEUR_PRIVE'),
  @JsonValue(r'INFORMEL')
  INFORMEL(r'INFORMEL'),
  @JsonValue(r'DIASPORA')
  DIASPORA(r'DIASPORA'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const ProspectType(this.value);

  final String value;

  @override
  String toString() => value;
}
