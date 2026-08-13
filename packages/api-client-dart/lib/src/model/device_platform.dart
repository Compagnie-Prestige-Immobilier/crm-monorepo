//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum DevicePlatform {
  @JsonValue(r'ANDROID')
  ANDROID(r'ANDROID'),
  @JsonValue(r'IOS')
  IOS(r'IOS'),
  @JsonValue(r'WEB')
  WEB(r'WEB'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const DevicePlatform(this.value);

  final String value;

  @override
  String toString() => value;
}
