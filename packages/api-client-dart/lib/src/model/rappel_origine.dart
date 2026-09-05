//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// PROMIS : la date convenue avec la personne. AUTOMATIQUE : le délai de réessai du dernier statut non joint. Nul en même temps que `nextCallbackAt`.
enum RappelOrigine {
          /// PROMIS : la date convenue avec la personne. AUTOMATIQUE : le délai de réessai du dernier statut non joint. Nul en même temps que `nextCallbackAt`.
      @JsonValue(r'PROMIS')
      PROMIS(r'PROMIS'),
          /// PROMIS : la date convenue avec la personne. AUTOMATIQUE : le délai de réessai du dernier statut non joint. Nul en même temps que `nextCallbackAt`.
      @JsonValue(r'AUTOMATIQUE')
      AUTOMATIQUE(r'AUTOMATIQUE'),
          /// PROMIS : la date convenue avec la personne. AUTOMATIQUE : le délai de réessai du dernier statut non joint. Nul en même temps que `nextCallbackAt`.
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const RappelOrigine(this.value);

  final String value;

  @override
  String toString() => value;
}
