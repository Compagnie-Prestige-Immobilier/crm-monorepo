//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum RepresentantSortField {
  @JsonValue(r'clientCreatedAt')
  clientCreatedAt(r'clientCreatedAt'),
  @JsonValue(r'createdAt')
  createdAt(r'createdAt'),
  @JsonValue(r'fullName')
  fullName(r'fullName'),
  @JsonValue(r'prospects')
  prospects(r'prospects'),
  @JsonValue(r'lastCallAt')
  lastCallAt(r'lastCallAt'),
  @JsonValue(r'nextCallbackAt')
  nextCallbackAt(r'nextCallbackAt'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const RepresentantSortField(this.value);

  final String value;

  @override
  String toString() => value;
}
