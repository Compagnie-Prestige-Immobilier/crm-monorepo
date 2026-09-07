//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum FicheChangeSource {
  @JsonValue(r'WEB')
  WEB(r'WEB'),
  @JsonValue(r'MOBILE')
  MOBILE(r'MOBILE'),
  @JsonValue(r'APPEL')
  APPEL(r'APPEL'),
  @JsonValue(r'IMPORT')
  IMPORT(r'IMPORT'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const FicheChangeSource(this.value);

  final String value;

  @override
  String toString() => value;
}
