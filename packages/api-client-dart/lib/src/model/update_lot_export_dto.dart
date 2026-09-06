//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/lot_export_objectif_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_lot_export_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateLotExportDto {
  /// Returns a new [UpdateLotExportDto] instance.
  UpdateLotExportDto({this.name, this.objectifs});

  @JsonKey(name: r'name', required: false, includeIfNull: false)
  final String? name;

  @JsonKey(name: r'objectifs', required: false, includeIfNull: false)
  final List<LotExportObjectifDto>? objectifs;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateLotExportDto &&
            runtimeType == other.runtimeType &&
            equals([name, objectifs], [other.name, other.objectifs]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([name, objectifs]);

  factory UpdateLotExportDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateLotExportDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateLotExportDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
