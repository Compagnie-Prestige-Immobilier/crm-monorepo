//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum ExportMode {
  @JsonValue(r'filtered')
  filtered(r'filtered'),
  @JsonValue(r'consolidated')
  consolidated(r'consolidated'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const ExportMode(this.value);

  final String value;

  @override
  String toString() => value;
}
