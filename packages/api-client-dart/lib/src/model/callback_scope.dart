//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum CallbackScope {
      @JsonValue(r'today')
      today(r'today'),
      @JsonValue(r'overdue')
      overdue(r'overdue'),
      @JsonValue(r'week')
      week(r'week'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const CallbackScope(this.value);

  final String value;

  @override
  String toString() => value;
}
