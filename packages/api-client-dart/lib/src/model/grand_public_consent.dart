//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum GrandPublicConsent {
      @JsonValue(r'NON_DEMANDE')
      NON_DEMANDE(r'NON_DEMANDE'),
      @JsonValue(r'INTERESSE')
      INTERESSE(r'INTERESSE'),
      @JsonValue(r'REFUSE')
      REFUSE(r'REFUSE'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const GrandPublicConsent(this.value);

  final String value;

  @override
  String toString() => value;
}
