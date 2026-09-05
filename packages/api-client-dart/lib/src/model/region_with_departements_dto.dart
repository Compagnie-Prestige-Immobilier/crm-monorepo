//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/departement_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'region_with_departements_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RegionWithDepartementsDto {
  /// Returns a new [RegionWithDepartementsDto] instance.
  RegionWithDepartementsDto({
    required this.id,

    required this.code,

    required this.name,

    required this.departements,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(name: r'departements', required: true, includeIfNull: false)
  final List<DepartementDto> departements;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RegionWithDepartementsDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, code, name, departements],
              [other.id, other.code, other.name, other.departements],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([id, code, name, departements]);

  factory RegionWithDepartementsDto.fromJson(Map<String, dynamic> json) =>
      _$RegionWithDepartementsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RegionWithDepartementsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
