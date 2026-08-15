//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum RepCallOutcome {
  @JsonValue(r'REACHED')
  REACHED(r'REACHED'),
  @JsonValue(r'PROSPECTS_PROMISED')
  PROSPECTS_PROMISED(r'PROSPECTS_PROMISED'),
  @JsonValue(r'UNREACHABLE')
  UNREACHABLE(r'UNREACHABLE'),
  @JsonValue(r'CALLBACK')
  CALLBACK(r'CALLBACK'),
  @JsonValue(r'REFUSED')
  REFUSED(r'REFUSED'),
  @JsonValue(r'WRONG_NUMBER')
  WRONG_NUMBER(r'WRONG_NUMBER'),
  @JsonValue(r'OTHER')
  OTHER(r'OTHER'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const RepCallOutcome(this.value);

  final String value;

  @override
  String toString() => value;
}
