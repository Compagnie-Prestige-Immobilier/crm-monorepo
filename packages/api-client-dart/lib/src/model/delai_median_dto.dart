//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'delai_median_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DelaiMedianDto {
  /// Returns a new [DelaiMedianDto] instance.
  DelaiMedianDto({
    required this.leg,

    required this.label,

    required this.medianDays,

    required this.sample,
  });

  @JsonKey(name: r'leg', required: true, includeIfNull: false)
  final String leg;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'medianDays', required: true, includeIfNull: true)
  final num? medianDays;

  @JsonKey(name: r'sample', required: true, includeIfNull: false)
  final num sample;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DelaiMedianDto &&
            runtimeType == other.runtimeType &&
            equals(
              [leg, label, medianDays, sample],
              [other.leg, other.label, other.medianDays, other.sample],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([leg, label, medianDays, sample]);

  factory DelaiMedianDto.fromJson(Map<String, dynamic> json) =>
      _$DelaiMedianDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DelaiMedianDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
