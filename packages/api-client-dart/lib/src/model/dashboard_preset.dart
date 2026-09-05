//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum DashboardPreset {
      @JsonValue(r'essentiel')
      essentiel(r'essentiel'),
      @JsonValue(r'affluence')
      affluence(r'affluence'),
      @JsonValue(r'organisation')
      organisation(r'organisation'),
      @JsonValue(r'complet')
      complet(r'complet'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const DashboardPreset(this.value);

  final String value;

  @override
  String toString() => value;
}
