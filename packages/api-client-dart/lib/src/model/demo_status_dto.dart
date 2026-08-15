//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/demo_counts_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'demo_status_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DemoStatusDto {
  /// Returns a new [DemoStatusDto] instance.
  DemoStatusDto({
    required this.enabled,

    required this.seededAt,

    required this.canToggle,

    required this.reason,

    required this.counts,
  });

  /// Vrai si des données de démonstration sont actuellement en place ET visibles. ATTENTION, ce booléen a une SECONDE conséquence, que l’interface doit annoncer avant la bascule : tant qu’il vaut vrai, la plateforme est en LECTURE SEULE. Toute requête POST, PATCH, PUT ou DELETE est refusée en 409 avec le code `DEMO_MODE_READ_ONLY`. Restent ouvertes, et ce sont les seules : la bascule de démonstration elle-même (sans quoi le mode ne pourrait plus être éteint), l’authentification, la remontée hors ligne du mobile (`POST /v1/sync/push`, qui n’est JAMAIS refusée), le marquage en lu d’une notification personnelle, et l’aperçu d’un gabarit de notification (`POST /v1/notification-templates/render`, un calcul qui n’écrit rien malgré la méthode POST). Les lignes créées par ces chemins sont du travail RÉEL : elles sont écrites `isDemo: false` et survivent à l’extinction.
  @JsonKey(name: r'enabled', required: true, includeIfNull: false)
  final bool enabled;

  /// Date du dernier ensemencement, nulle si le mode n’a jamais été activé.
  @JsonKey(name: r'seededAt', required: true, includeIfNull: true)
  final DateTime? seededAt;

  /// Faux quand l’environnement interdit la bascule : en production, tant que DEMO_MODE_ALLOWED ne vaut pas true. L’interface doit afficher `reason`, pas se contenter de griser le bouton.
  @JsonKey(name: r'canToggle', required: true, includeIfNull: false)
  final bool canToggle;

  /// Explication lisible quand canToggle est faux.
  @JsonKey(name: r'reason', required: true, includeIfNull: true)
  final String? reason;

  @JsonKey(name: r'counts', required: true, includeIfNull: false)
  final DemoCountsDto counts;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DemoStatusDto &&
            runtimeType == other.runtimeType &&
            equals(
              [enabled, seededAt, canToggle, reason, counts],
              [
                other.enabled,
                other.seededAt,
                other.canToggle,
                other.reason,
                other.counts,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([enabled, seededAt, canToggle, reason, counts]);

  factory DemoStatusDto.fromJson(Map<String, dynamic> json) =>
      _$DemoStatusDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DemoStatusDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
