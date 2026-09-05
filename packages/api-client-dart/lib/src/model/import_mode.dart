//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// DRY_RUN simule et n’écrit rien. APPLY écrit. Un import naît TOUJOURS en DRY_RUN : appliquer cinquante mille lignes sans les avoir vues ne se rattrape pas.
enum ImportMode {
          /// DRY_RUN simule et n’écrit rien. APPLY écrit. Un import naît TOUJOURS en DRY_RUN : appliquer cinquante mille lignes sans les avoir vues ne se rattrape pas.
      @JsonValue(r'DRY_RUN')
      DRY_RUN(r'DRY_RUN'),
          /// DRY_RUN simule et n’écrit rien. APPLY écrit. Un import naît TOUJOURS en DRY_RUN : appliquer cinquante mille lignes sans les avoir vues ne se rattrape pas.
      @JsonValue(r'APPLY')
      APPLY(r'APPLY'),
          /// DRY_RUN simule et n’écrit rien. APPLY écrit. Un import naît TOUJOURS en DRY_RUN : appliquer cinquante mille lignes sans les avoir vues ne se rattrape pas.
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const ImportMode(this.value);

  final String value;

  @override
  String toString() => value;
}
