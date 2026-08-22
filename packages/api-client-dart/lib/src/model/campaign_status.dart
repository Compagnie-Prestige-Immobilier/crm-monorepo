//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum CampaignStatus {
  @JsonValue(r'DRAFT')
  DRAFT(r'DRAFT'),
  @JsonValue(r'ACTIVE')
  ACTIVE(r'ACTIVE'),
  @JsonValue(r'PAUSED')
  PAUSED(r'PAUSED'),
  @JsonValue(r'CLOSED')
  CLOSED(r'CLOSED'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const CampaignStatus(this.value);

  final String value;

  @override
  String toString() => value;
}
