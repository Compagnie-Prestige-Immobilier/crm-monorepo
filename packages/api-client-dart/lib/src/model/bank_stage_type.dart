//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum BankStageType {
      @JsonValue(r'OPEN')
      OPEN(r'OPEN'),
      @JsonValue(r'CASHED')
      CASHED(r'CASHED'),
      @JsonValue(r'REJECTED')
      REJECTED(r'REJECTED'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const BankStageType(this.value);

  final String value;

  @override
  String toString() => value;
}
