//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum BankCaseSortField {
  @JsonValue(r'createdAt')
  createdAt(r'createdAt'),
  @JsonValue(r'updatedAt')
  updatedAt(r'updatedAt'),
  @JsonValue(r'reference')
  reference(r'reference'),
  @JsonValue(r'customerName')
  customerName(r'customerName'),
  @JsonValue(r'amountXof')
  amountXof(r'amountXof'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const BankCaseSortField(this.value);

  final String value;

  @override
  String toString() => value;
}
