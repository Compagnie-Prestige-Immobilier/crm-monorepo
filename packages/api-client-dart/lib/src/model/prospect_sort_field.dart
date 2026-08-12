//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum ProspectSortField {
  @JsonValue(r'createdAt')
  createdAt(r'createdAt'),
  @JsonValue(r'clientCreatedAt')
  clientCreatedAt(r'clientCreatedAt'),
  @JsonValue(r'nom')
  nom(r'nom'),
  @JsonValue(r'prenom')
  prenom(r'prenom'),
  @JsonValue(r'statut')
  statut(r'statut'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const ProspectSortField(this.value);

  final String value;

  @override
  String toString() => value;
}
