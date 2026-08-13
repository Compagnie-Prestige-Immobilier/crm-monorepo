//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum NotificationStatus {
  @JsonValue(r'SCHEDULED')
  SCHEDULED(r'SCHEDULED'),
  @JsonValue(r'SENDING')
  SENDING(r'SENDING'),
  @JsonValue(r'SENT')
  SENT(r'SENT'),
  @JsonValue(r'CANCELLED')
  CANCELLED(r'CANCELLED'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const NotificationStatus(this.value);

  final String value;

  @override
  String toString() => value;
}
