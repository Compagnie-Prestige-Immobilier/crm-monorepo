//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// Issue du dernier appel. Nul : jamais appelé.
enum RepCallOutcome {
  /// Issue du dernier appel. Nul : jamais appelé.
  @JsonValue(r'REACHED')
  REACHED(r'REACHED'),

  /// Issue du dernier appel. Nul : jamais appelé.
  @JsonValue(r'PROSPECTS_PROMISED')
  PROSPECTS_PROMISED(r'PROSPECTS_PROMISED'),

  /// Issue du dernier appel. Nul : jamais appelé.
  @JsonValue(r'UNREACHABLE')
  UNREACHABLE(r'UNREACHABLE'),

  /// Issue du dernier appel. Nul : jamais appelé.
  @JsonValue(r'CALLBACK')
  CALLBACK(r'CALLBACK'),

  /// Issue du dernier appel. Nul : jamais appelé.
  @JsonValue(r'REFUSED')
  REFUSED(r'REFUSED'),

  /// Issue du dernier appel. Nul : jamais appelé.
  @JsonValue(r'WRONG_NUMBER')
  WRONG_NUMBER(r'WRONG_NUMBER'),

  /// Issue du dernier appel. Nul : jamais appelé.
  @JsonValue(r'OTHER')
  OTHER(r'OTHER'),

  /// Issue du dernier appel. Nul : jamais appelé.
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const RepCallOutcome(this.value);

  final String value;

  @override
  String toString() => value;
}
