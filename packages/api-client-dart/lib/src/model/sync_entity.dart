//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum SyncEntity {
  @JsonValue(r'representant')
  representant(r'representant'),
  @JsonValue(r'prospect')
  prospect(r'prospect'),
  @JsonValue(r'call_attempt')
  callAttempt(r'call_attempt'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const SyncEntity(this.value);

  final String value;

  @override
  String toString() => value;
}
