//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum Phase2Status {
  @JsonValue(r'PENDING')
  PENDING(r'PENDING'),
  @JsonValue(r'METHOD_OBTAINED')
  METHOD_OBTAINED(r'METHOD_OBTAINED'),
  @JsonValue(r'REFUSED')
  REFUSED(r'REFUSED'),
  @JsonValue(r'WRONG_NUMBER')
  WRONG_NUMBER(r'WRONG_NUMBER'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const Phase2Status(this.value);

  final String value;

  @override
  String toString() => value;
}
