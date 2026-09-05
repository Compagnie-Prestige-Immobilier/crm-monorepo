//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum NotificationDeliveryStatus {
  @JsonValue(r'PENDING')
  PENDING(r'PENDING'),
  @JsonValue(r'SENT')
  SENT(r'SENT'),
  @JsonValue(r'DELIVERED')
  DELIVERED(r'DELIVERED'),
  @JsonValue(r'FAILED')
  FAILED(r'FAILED'),
  @JsonValue(r'READ')
  READ(r'READ'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const NotificationDeliveryStatus(this.value);

  final String value;

  @override
  String toString() => value;
}
