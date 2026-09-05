//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum BankAgeBucket {
      @JsonValue(r'J0_7')
      J0_7(r'J0_7'),
      @JsonValue(r'J8_15')
      J8_15(r'J8_15'),
      @JsonValue(r'J16_30')
      J16_30(r'J16_30'),
      @JsonValue(r'J31_60')
      J31_60(r'J31_60'),
      @JsonValue(r'J60_PLUS')
      J60_PLUS(r'J60_PLUS'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const BankAgeBucket(this.value);

  final String value;

  @override
  String toString() => value;
}
