//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum PaymentMode {
      @JsonValue(r'COMPTANT')
      COMPTANT(r'COMPTANT'),
      @JsonValue(r'ECHELONNE')
      ECHELONNE(r'ECHELONNE'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const PaymentMode(this.value);

  final String value;

  @override
  String toString() => value;
}
