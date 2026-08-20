//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum WhatsappStatus {
  @JsonValue(r'NON_DEMANDE')
  NON_DEMANDE(r'NON_DEMANDE'),
  @JsonValue(r'MEME_NUMERO')
  MEME_NUMERO(r'MEME_NUMERO'),
  @JsonValue(r'AUTRE_NUMERO')
  AUTRE_NUMERO(r'AUTRE_NUMERO'),
  @JsonValue(r'AUCUN')
  AUCUN(r'AUCUN'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const WhatsappStatus(this.value);

  final String value;

  @override
  String toString() => value;
}
