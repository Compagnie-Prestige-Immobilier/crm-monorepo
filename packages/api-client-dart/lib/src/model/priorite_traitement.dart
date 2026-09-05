//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// Ordre de reprise : un « Très intéressé » se rappelle avant un « Non éligible ».
enum PrioriteTraitement {
          /// Ordre de reprise : un « Très intéressé » se rappelle avant un « Non éligible ».
      @JsonValue(r'HAUTE')
      HAUTE(r'HAUTE'),
          /// Ordre de reprise : un « Très intéressé » se rappelle avant un « Non éligible ».
      @JsonValue(r'NORMALE')
      NORMALE(r'NORMALE'),
          /// Ordre de reprise : un « Très intéressé » se rappelle avant un « Non éligible ».
      @JsonValue(r'BASSE')
      BASSE(r'BASSE'),
          /// Ordre de reprise : un « Très intéressé » se rappelle avant un « Non éligible ».
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const PrioriteTraitement(this.value);

  final String value;

  @override
  String toString() => value;
}
