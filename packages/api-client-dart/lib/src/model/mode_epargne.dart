//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum ModeEpargne {
  @JsonValue(r'TONTINE')
  TONTINE(r'TONTINE'),
  @JsonValue(r'MOBILE_MONEY')
  MOBILE_MONEY(r'MOBILE_MONEY'),
  @JsonValue(r'BANQUE')
  BANQUE(r'BANQUE'),
  @JsonValue(r'AUCUN')
  AUCUN(r'AUCUN'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const ModeEpargne(this.value);

  final String value;

  @override
  String toString() => value;
}
