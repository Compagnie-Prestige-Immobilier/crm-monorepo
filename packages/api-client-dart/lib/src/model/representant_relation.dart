//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// La relation posée sur la fiche. Nulle quand le statut ne tranche rien.
enum RepresentantRelation {
          /// La relation posée sur la fiche. Nulle quand le statut ne tranche rien.
      @JsonValue(r'INCONNU')
      INCONNU(r'INCONNU'),
          /// La relation posée sur la fiche. Nulle quand le statut ne tranche rien.
      @JsonValue(r'CONTACTE')
      CONTACTE(r'CONTACTE'),
          /// La relation posée sur la fiche. Nulle quand le statut ne tranche rien.
      @JsonValue(r'AMBASSADEUR')
      AMBASSADEUR(r'AMBASSADEUR'),
          /// La relation posée sur la fiche. Nulle quand le statut ne tranche rien.
      @JsonValue(r'REFUS')
      REFUS(r'REFUS'),
          /// La relation posée sur la fiche. Nulle quand le statut ne tranche rien.
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const RepresentantRelation(this.value);

  final String value;

  @override
  String toString() => value;
}
