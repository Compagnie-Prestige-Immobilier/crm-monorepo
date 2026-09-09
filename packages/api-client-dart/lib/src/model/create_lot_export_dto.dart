//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/representant_export_query_dto.dart';
import 'package:crm_api_client/src/model/lot_export_distribution_input_dto.dart';
import 'package:crm_api_client/src/model/lot_export_prospect_filter_dto.dart';
import 'package:crm_api_client/src/model/lot_export_cible.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_lot_export_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateLotExportDto {
  /// Returns a new [CreateLotExportDto] instance.
  CreateLotExportDto({
    required this.name,

    required this.cible,

    this.representants,

    this.prospects,

    required this.distribution,
  });

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(
    name: r'cible',
    required: true,
    includeIfNull: false,
    unknownEnumValue: LotExportCible.unknownDefaultOpenApi,
  )
  final LotExportCible cible;

  @JsonKey(name: r'representants', required: false, includeIfNull: false)
  final RepresentantExportQueryDto? representants;

  @JsonKey(name: r'prospects', required: false, includeIfNull: false)
  final LotExportProspectFilterDto? prospects;

  @JsonKey(name: r'distribution', required: true, includeIfNull: false)
  final LotExportDistributionInputDto distribution;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateLotExportDto &&
            runtimeType == other.runtimeType &&
            equals(
              [name, cible, representants, prospects, distribution],
              [
                other.name,
                other.cible,
                other.representants,
                other.prospects,
                other.distribution,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([name, cible, representants, prospects, distribution]);

  factory CreateLotExportDto.fromJson(Map<String, dynamic> json) =>
      _$CreateLotExportDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateLotExportDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
