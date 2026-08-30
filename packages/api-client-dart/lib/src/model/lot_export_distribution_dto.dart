//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'lot_export_distribution_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LotExportDistributionDto {
  /// Returns a new [LotExportDistributionDto] instance.
  LotExportDistributionDto({required this.fichesParJour, required this.jours});

  @JsonKey(name: r'fichesParJour', required: true, includeIfNull: false)
  final num fichesParJour;

  @JsonKey(name: r'jours', required: true, includeIfNull: false)
  final num jours;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is LotExportDistributionDto &&
            runtimeType == other.runtimeType &&
            equals([fichesParJour, jours], [other.fichesParJour, other.jours]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([fichesParJour, jours]);

  factory LotExportDistributionDto.fromJson(Map<String, dynamic> json) =>
      _$LotExportDistributionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LotExportDistributionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
