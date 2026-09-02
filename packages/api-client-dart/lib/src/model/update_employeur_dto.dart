//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/employeur_type.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_employeur_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateEmployeurDto {
  /// Returns a new [UpdateEmployeurDto] instance.
  UpdateEmployeurDto({
    this.code,

    this.label,

    this.type,

    this.position,

    this.isActive = true,
  });

  @JsonKey(name: r'code', required: false, includeIfNull: false)
  final String? code;

  @JsonKey(name: r'label', required: false, includeIfNull: false)
  final String? label;

  @JsonKey(
    name: r'type',
    required: false,
    includeIfNull: false,
    unknownEnumValue: EmployeurType.unknownDefaultOpenApi,
  )
  final EmployeurType? type;

  // minimum: 0
  // maximum: 9999
  @JsonKey(name: r'position', required: false, includeIfNull: false)
  final num? position;

  @JsonKey(
    defaultValue: true,
    name: r'isActive',
    required: false,
    includeIfNull: false,
  )
  final bool? isActive;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateEmployeurDto &&
            runtimeType == other.runtimeType &&
            equals(
              [code, label, type, position, isActive],
              [
                other.code,
                other.label,
                other.type,
                other.position,
                other.isActive,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([code, label, type, position, isActive]);

  factory UpdateEmployeurDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateEmployeurDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateEmployeurDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
