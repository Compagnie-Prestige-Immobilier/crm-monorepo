//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// Le canal qui a écrit la bascule. Le panel écrit WEB.
enum ChangeSource {
  /// Le canal qui a écrit la bascule. Le panel écrit WEB.
  @JsonValue(r'WEB')
  WEB(r'WEB'),

  /// Le canal qui a écrit la bascule. Le panel écrit WEB.
  @JsonValue(r'MOBILE')
  MOBILE(r'MOBILE'),

  /// Le canal qui a écrit la bascule. Le panel écrit WEB.
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const ChangeSource(this.value);

  final String value;

  @override
  String toString() => value;
}
