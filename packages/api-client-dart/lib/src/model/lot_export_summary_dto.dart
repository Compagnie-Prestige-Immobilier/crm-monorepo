//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/lot_export_cible.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'lot_export_summary_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LotExportSummaryDto {
  /// Returns a new [LotExportSummaryDto] instance.
  LotExportSummaryDto({
    required this.id,

    required this.name,

    required this.cible,

    required this.projet,

    required this.scopeLabel,

    required this.itemCount,

    required this.createdById,

    required this.createdByName,

    required this.createdAt,

    required this.callsSince,

    required this.fichesAppelees,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(
    name: r'cible',
    required: true,
    includeIfNull: false,
    unknownEnumValue: LotExportCible.unknownDefaultOpenApi,
  )
  final LotExportCible cible;

  @JsonKey(
    name: r'projet',
    required: true,
    includeIfNull: true,
    unknownEnumValue: Projet.unknownDefaultOpenApi,
  )
  final Projet? projet;

  @JsonKey(name: r'scopeLabel', required: true, includeIfNull: false)
  final String scopeLabel;

  @JsonKey(name: r'itemCount', required: true, includeIfNull: false)
  final num itemCount;

  @JsonKey(name: r'createdById', required: true, includeIfNull: false)
  final String createdById;

  @JsonKey(name: r'createdByName', required: true, includeIfNull: false)
  final String createdByName;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final String createdAt;

  @JsonKey(name: r'callsSince', required: true, includeIfNull: false)
  final num callsSince;

  @JsonKey(name: r'fichesAppelees', required: true, includeIfNull: false)
  final num fichesAppelees;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is LotExportSummaryDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                name,
                cible,
                projet,
                scopeLabel,
                itemCount,
                createdById,
                createdByName,
                createdAt,
                callsSince,
                fichesAppelees,
              ],
              [
                other.id,
                other.name,
                other.cible,
                other.projet,
                other.scopeLabel,
                other.itemCount,
                other.createdById,
                other.createdByName,
                other.createdAt,
                other.callsSince,
                other.fichesAppelees,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        name,
        cible,
        projet,
        scopeLabel,
        itemCount,
        createdById,
        createdByName,
        createdAt,
        callsSince,
        fichesAppelees,
      ]);

  factory LotExportSummaryDto.fromJson(Map<String, dynamic> json) =>
      _$LotExportSummaryDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LotExportSummaryDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
