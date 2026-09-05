//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/delay_leg.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'delay_leg_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DelayLegDto {
  /// Returns a new [DelayLegDto] instance.
  DelayLegDto({
    required this.leg,

    required this.label,

    required this.medianDays,

    required this.p90Days,

    required this.sample,
  });

  @JsonKey(
    name: r'leg',
    required: true,
    includeIfNull: false,
    unknownEnumValue: DelayLeg.unknownDefaultOpenApi,
  )
  final DelayLeg leg;

  /// Libellé prêt à afficher.
  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  /// Durée médiane en jours. Nulle, et jamais 0, quand aucun couple d’horodatages n’est exploitable : 0 se lirait comme « instantané ».
  @JsonKey(name: r'medianDays', required: true, includeIfNull: true)
  final num? medianDays;

  /// Neuvième décile en jours, pour la queue de distribution.
  @JsonKey(name: r'p90Days', required: true, includeIfNull: true)
  final num? p90Days;

  /// Nombre de couples d’horodatages exploitables.
  @JsonKey(name: r'sample', required: true, includeIfNull: false)
  final num sample;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DelayLegDto &&
            runtimeType == other.runtimeType &&
            equals(
              [leg, label, medianDays, p90Days, sample],
              [
                other.leg,
                other.label,
                other.medianDays,
                other.p90Days,
                other.sample,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([leg, label, medianDays, p90Days, sample]);

  factory DelayLegDto.fromJson(Map<String, dynamic> json) =>
      _$DelayLegDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DelayLegDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
