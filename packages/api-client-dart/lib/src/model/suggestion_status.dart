//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum SuggestionStatus {
      @JsonValue(r'A_APPELER')
      A_APPELER(r'A_APPELER'),
      @JsonValue(r'APPELE')
      APPELE(r'APPELE'),
      @JsonValue(r'ABANDONNE')
      ABANDONNE(r'ABANDONNE'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const SuggestionStatus(this.value);

  final String value;

  @override
  String toString() => value;
}
