//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum DelayLeg {
  @JsonValue(r'CREATION_TO_METHOD')
  CREATION_TO_METHOD(r'CREATION_TO_METHOD'),
  @JsonValue(r'METHOD_TO_CASE')
  METHOD_TO_CASE(r'METHOD_TO_CASE'),
  @JsonValue(r'CASE_TO_CASHED')
  CASE_TO_CASHED(r'CASE_TO_CASHED'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const DelayLeg(this.value);

  final String value;

  @override
  String toString() => value;
}
