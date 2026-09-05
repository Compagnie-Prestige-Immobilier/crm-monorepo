//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum SyncOpStatus {
  @JsonValue(r'applied')
  applied(r'applied'),
  @JsonValue(r'duplicate')
  duplicate(r'duplicate'),
  @JsonValue(r'conflict')
  conflict(r'conflict'),
  @JsonValue(r'invalid')
  invalid(r'invalid'),
  @JsonValue(r'skipped_dependency_failed')
  skippedDependencyFailed(r'skipped_dependency_failed'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const SyncOpStatus(this.value);

  final String value;

  @override
  String toString() => value;
}
