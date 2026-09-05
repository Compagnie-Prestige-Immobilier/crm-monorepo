//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// Résultat de la dernière tentative d’appel enregistrée.
enum CallOutcome {
  /// Résultat de la dernière tentative d’appel enregistrée.
  @JsonValue(r'METHOD_OBTAINED')
  METHOD_OBTAINED(r'METHOD_OBTAINED'),

  /// Résultat de la dernière tentative d’appel enregistrée.
  @JsonValue(r'UNREACHABLE')
  UNREACHABLE(r'UNREACHABLE'),

  /// Résultat de la dernière tentative d’appel enregistrée.
  @JsonValue(r'CALLBACK')
  CALLBACK(r'CALLBACK'),

  /// Résultat de la dernière tentative d’appel enregistrée.
  @JsonValue(r'REFUSED')
  REFUSED(r'REFUSED'),

  /// Résultat de la dernière tentative d’appel enregistrée.
  @JsonValue(r'WRONG_NUMBER')
  WRONG_NUMBER(r'WRONG_NUMBER'),

  /// Résultat de la dernière tentative d’appel enregistrée.
  @JsonValue(r'OTHER')
  OTHER(r'OTHER'),

  /// Résultat de la dernière tentative d’appel enregistrée.
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const CallOutcome(this.value);

  final String value;

  @override
  String toString() => value;
}
