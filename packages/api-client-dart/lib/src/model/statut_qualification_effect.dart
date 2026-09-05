//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum StatutQualificationEffect {
      @JsonValue(r'REACHED')
      REACHED(r'REACHED'),
      @JsonValue(r'REFUSED')
      REFUSED(r'REFUSED'),
      @JsonValue(r'SCHEDULE_CALLBACK')
      SCHEDULE_CALLBACK(r'SCHEDULE_CALLBACK'),
      @JsonValue(r'UNREACHABLE')
      UNREACHABLE(r'UNREACHABLE'),
      @JsonValue(r'WRONG_NUMBER')
      WRONG_NUMBER(r'WRONG_NUMBER'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const StatutQualificationEffect(this.value);

  final String value;

  @override
  String toString() => value;
}
