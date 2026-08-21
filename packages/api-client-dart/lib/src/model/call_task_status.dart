//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum CallTaskStatus {
  @JsonValue(r'OPEN')
  OPEN(r'OPEN'),
  @JsonValue(r'DONE')
  DONE(r'DONE'),
  @JsonValue(r'CANCELLED')
  CANCELLED(r'CANCELLED'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const CallTaskStatus(this.value);

  final String value;

  @override
  String toString() => value;
}
