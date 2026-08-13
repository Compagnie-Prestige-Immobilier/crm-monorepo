//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum PresenceState {
  @JsonValue(r'ONLINE')
  ONLINE(r'ONLINE'),
  @JsonValue(r'RECENT')
  RECENT(r'RECENT'),
  @JsonValue(r'AWAY')
  AWAY(r'AWAY'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const PresenceState(this.value);

  final String value;

  @override
  String toString() => value;
}
