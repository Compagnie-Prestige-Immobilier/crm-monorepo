//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum NotificationCategory {
      @JsonValue(r'ANNONCE')
      ANNONCE(r'ANNONCE'),
      @JsonValue(r'RAPPEL')
      RAPPEL(r'RAPPEL'),
      @JsonValue(r'CAMPAGNE')
      CAMPAGNE(r'CAMPAGNE'),
      @JsonValue(r'DOSSIER')
      DOSSIER(r'DOSSIER'),
      @JsonValue(r'SYSTEME')
      SYSTEME(r'SYSTEME'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const NotificationCategory(this.value);

  final String value;

  @override
  String toString() => value;
}
