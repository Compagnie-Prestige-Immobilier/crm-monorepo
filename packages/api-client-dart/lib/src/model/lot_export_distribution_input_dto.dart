//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/lot_export_objectif_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'lot_export_distribution_input_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LotExportDistributionInputDto {
  /// Returns a new [LotExportDistributionInputDto] instance.
  LotExportDistributionInputDto({
    required this.teleconseillerIds,

    this.fichesParJour = 50,

    this.jours = 1,

    this.objectifs,
  });

  @JsonKey(name: r'teleconseillerIds', required: true, includeIfNull: false)
  final List<String> teleconseillerIds;

  // minimum: 1
  // maximum: 500
  @JsonKey(
    defaultValue: 50,
    name: r'fichesParJour',
    required: false,
    includeIfNull: false,
  )
  final num? fichesParJour;

  // minimum: 1
  // maximum: 10
  @JsonKey(
    defaultValue: 1,
    name: r'jours',
    required: false,
    includeIfNull: false,
  )
  final num? jours;

  @JsonKey(name: r'objectifs', required: false, includeIfNull: false)
  final List<LotExportObjectifDto>? objectifs;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is LotExportDistributionInputDto &&
            runtimeType == other.runtimeType &&
            equals(
              [teleconseillerIds, fichesParJour, jours, objectifs],
              [
                other.teleconseillerIds,
                other.fichesParJour,
                other.jours,
                other.objectifs,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([teleconseillerIds, fichesParJour, jours, objectifs]);

  factory LotExportDistributionInputDto.fromJson(Map<String, dynamic> json) =>
      _$LotExportDistributionInputDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LotExportDistributionInputDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
