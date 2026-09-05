//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_call_outcome_reason_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateCallOutcomeReasonDto {
  /// Returns a new [UpdateCallOutcomeReasonDto] instance.
  UpdateCallOutcomeReasonDto({
    this.label,

    this.color,

    this.sortOrder,

    this.requiresComment,

    this.requiresCallback,

    this.countsAsReached,
  });

  @JsonKey(name: r'label', required: false, includeIfNull: false)
  final String? label;

  @JsonKey(name: r'color', required: false, includeIfNull: false)
  final String? color;

  @JsonKey(name: r'sortOrder', required: false, includeIfNull: false)
  final num? sortOrder;

  @JsonKey(name: r'requiresComment', required: false, includeIfNull: false)
  final bool? requiresComment;

  @JsonKey(name: r'requiresCallback', required: false, includeIfNull: false)
  final bool? requiresCallback;

  @JsonKey(name: r'countsAsReached', required: false, includeIfNull: false)
  final bool? countsAsReached;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateCallOutcomeReasonDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                label,
                color,
                sortOrder,
                requiresComment,
                requiresCallback,
                countsAsReached,
              ],
              [
                other.label,
                other.color,
                other.sortOrder,
                other.requiresComment,
                other.requiresCallback,
                other.countsAsReached,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        label,
        color,
        sortOrder,
        requiresComment,
        requiresCallback,
        countsAsReached,
      ]);

  factory UpdateCallOutcomeReasonDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateCallOutcomeReasonDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateCallOutcomeReasonDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
