//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum CallOutcomeEffect {
      @JsonValue(r'CLOSE_METHOD')
      CLOSE_METHOD(r'CLOSE_METHOD'),
      @JsonValue(r'CLOSE_REFUSED')
      CLOSE_REFUSED(r'CLOSE_REFUSED'),
      @JsonValue(r'CLOSE_WRONG_NUMBER')
      CLOSE_WRONG_NUMBER(r'CLOSE_WRONG_NUMBER'),
      @JsonValue(r'KEEP_OPEN')
      KEEP_OPEN(r'KEEP_OPEN'),
      @JsonValue(r'SCHEDULE_CALLBACK')
      SCHEDULE_CALLBACK(r'SCHEDULE_CALLBACK'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const CallOutcomeEffect(this.value);

  final String value;

  @override
  String toString() => value;
}
