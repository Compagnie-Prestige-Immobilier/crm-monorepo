//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_work_shifts_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateWorkShiftsDto {
  /// Returns a new [UpdateWorkShiftsDto] instance.
  UpdateWorkShiftsDto({
    required this.morningStart,

    required this.morningEnd,

    required this.afternoonStart,

    required this.afternoonEnd,
  });

  @JsonKey(name: r'morningStart', required: true, includeIfNull: false)
  final String morningStart;

  @JsonKey(name: r'morningEnd', required: true, includeIfNull: false)
  final String morningEnd;

  @JsonKey(name: r'afternoonStart', required: true, includeIfNull: false)
  final String afternoonStart;

  @JsonKey(name: r'afternoonEnd', required: true, includeIfNull: false)
  final String afternoonEnd;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateWorkShiftsDto &&
            runtimeType == other.runtimeType &&
            equals(
              [morningStart, morningEnd, afternoonStart, afternoonEnd],
              [
                other.morningStart,
                other.morningEnd,
                other.afternoonStart,
                other.afternoonEnd,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        morningStart,
        morningEnd,
        afternoonStart,
        afternoonEnd,
      ]);

  factory UpdateWorkShiftsDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateWorkShiftsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateWorkShiftsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
