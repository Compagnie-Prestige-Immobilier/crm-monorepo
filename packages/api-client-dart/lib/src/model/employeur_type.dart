//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum EmployeurType {
  @JsonValue(r'MINISTERE')
  MINISTERE(r'MINISTERE'),
  @JsonValue(r'ENTREPRISE')
  ENTREPRISE(r'ENTREPRISE'),
  @JsonValue(r'AUTRE')
  AUTRE(r'AUTRE'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const EmployeurType(this.value);

  final String value;

  @override
  String toString() => value;
}
