//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum EnrollmentMethod {
  @JsonValue(r'PLATFORM')
  PLATFORM(r'PLATFORM'),
  @JsonValue(r'PHYSICAL')
  PHYSICAL(r'PHYSICAL'),
  @JsonValue(r'VOICE_OR_ELECTRONIC_MESSAGING')
  VOICE_OR_ELECTRONIC_MESSAGING(r'VOICE_OR_ELECTRONIC_MESSAGING'),
  @JsonValue(r'APPOINTMENT')
  APPOINTMENT(r'APPOINTMENT'),
  @JsonValue(r'WHATSAPP')
  WHATSAPP(r'WHATSAPP'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const EnrollmentMethod(this.value);

  final String value;

  @override
  String toString() => value;
}
