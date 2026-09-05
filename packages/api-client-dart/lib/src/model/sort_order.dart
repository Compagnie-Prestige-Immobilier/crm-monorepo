//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum SortOrder {
      @JsonValue(r'asc')
      asc(r'asc'),
      @JsonValue(r'desc')
      desc(r'desc'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const SortOrder(this.value);

  final String value;

  @override
  String toString() => value;
}
