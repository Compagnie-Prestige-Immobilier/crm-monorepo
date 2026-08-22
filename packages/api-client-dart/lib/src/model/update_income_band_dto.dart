//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_income_band_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateIncomeBandDto {
  /// Returns a new [UpdateIncomeBandDto] instance.
  UpdateIncomeBandDto({
    this.code,

    this.label,

    this.minXof,

    this.maxXof,

    this.position,

    this.isActive = true,
  });

  @JsonKey(name: r'code', required: false, includeIfNull: false)
  final String? code;

  @JsonKey(name: r'label', required: false, includeIfNull: false)
  final String? label;

  // minimum: 0
  @JsonKey(name: r'minXof', required: false, includeIfNull: false)
  final num? minXof;

  // minimum: 0
  @JsonKey(name: r'maxXof', required: false, includeIfNull: false)
  final num? maxXof;

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
        other is UpdateIncomeBandDto &&
            runtimeType == other.runtimeType &&
            equals(
              [code, label, minXof, maxXof, position, isActive],
              [
                other.code,
                other.label,
                other.minXof,
                other.maxXof,
                other.position,
                other.isActive,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([code, label, minXof, maxXof, position, isActive]);

  factory UpdateIncomeBandDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateIncomeBandDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateIncomeBandDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
