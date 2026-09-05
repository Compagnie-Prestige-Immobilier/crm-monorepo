//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum RepCallAttemptApplyStatus {
      @JsonValue(r'applied')
      applied(r'applied'),
      @JsonValue(r'duplicate')
      duplicate(r'duplicate'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const RepCallAttemptApplyStatus(this.value);

  final String value;

  @override
  String toString() => value;
}
