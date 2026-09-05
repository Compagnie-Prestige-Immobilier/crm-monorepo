//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// `queued` : le travail attend un travailleur. `running` : il court, `processedRows` avance. `succeeded` : terminé, le rapport est là. `failed` : le motif est dans `failureCode`. `expired` : le fichier déposé et le rapport ont été détruits à l’échéance ; ce n’est pas une erreur.
enum ImportStatus {
          /// `queued` : le travail attend un travailleur. `running` : il court, `processedRows` avance. `succeeded` : terminé, le rapport est là. `failed` : le motif est dans `failureCode`. `expired` : le fichier déposé et le rapport ont été détruits à l’échéance ; ce n’est pas une erreur.
      @JsonValue(r'queued')
      queued(r'queued'),
          /// `queued` : le travail attend un travailleur. `running` : il court, `processedRows` avance. `succeeded` : terminé, le rapport est là. `failed` : le motif est dans `failureCode`. `expired` : le fichier déposé et le rapport ont été détruits à l’échéance ; ce n’est pas une erreur.
      @JsonValue(r'running')
      running(r'running'),
          /// `queued` : le travail attend un travailleur. `running` : il court, `processedRows` avance. `succeeded` : terminé, le rapport est là. `failed` : le motif est dans `failureCode`. `expired` : le fichier déposé et le rapport ont été détruits à l’échéance ; ce n’est pas une erreur.
      @JsonValue(r'succeeded')
      succeeded(r'succeeded'),
          /// `queued` : le travail attend un travailleur. `running` : il court, `processedRows` avance. `succeeded` : terminé, le rapport est là. `failed` : le motif est dans `failureCode`. `expired` : le fichier déposé et le rapport ont été détruits à l’échéance ; ce n’est pas une erreur.
      @JsonValue(r'failed')
      failed(r'failed'),
          /// `queued` : le travail attend un travailleur. `running` : il court, `processedRows` avance. `succeeded` : terminé, le rapport est là. `failed` : le motif est dans `failureCode`. `expired` : le fichier déposé et le rapport ont été détruits à l’échéance ; ce n’est pas une erreur.
      @JsonValue(r'expired')
      expired(r'expired'),
          /// `queued` : le travail attend un travailleur. `running` : il court, `processedRows` avance. `succeeded` : terminé, le rapport est là. `failed` : le motif est dans `failureCode`. `expired` : le fichier déposé et le rapport ont été détruits à l’échéance ; ce n’est pas une erreur.
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const ImportStatus(this.value);

  final String value;

  @override
  String toString() => value;
}
