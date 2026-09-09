//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/call_outcome_effect.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_call_outcome_reason_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateCallOutcomeReasonDto {
  /// Returns a new [CreateCallOutcomeReasonDto] instance.
  CreateCallOutcomeReasonDto({
    required this.code,

    required this.label,

    required this.effect,

    this.requiresComment = false,

    this.requiresCallback = false,

    this.countsAsReached = true,

    this.color,

    this.sortOrder = 100,
  });

  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(
    name: r'effect',
    required: true,
    includeIfNull: false,
    unknownEnumValue: CallOutcomeEffect.unknownDefaultOpenApi,
  )
  final CallOutcomeEffect effect;

  @JsonKey(
    defaultValue: false,
    name: r'requiresComment',
    required: false,
    includeIfNull: false,
  )
  final bool? requiresComment;

  /// Réservé à l’effet SCHEDULE_CALLBACK.
  @JsonKey(
    defaultValue: false,
    name: r'requiresCallback',
    required: false,
    includeIfNull: false,
  )
  final bool? requiresCallback;

  @JsonKey(
    defaultValue: true,
    name: r'countsAsReached',
    required: false,
    includeIfNull: false,
  )
  final bool? countsAsReached;

  /// Rôle du design system.
  @JsonKey(name: r'color', required: false, includeIfNull: false)
  final String? color;

  @JsonKey(
    defaultValue: 100,
    name: r'sortOrder',
    required: false,
    includeIfNull: false,
  )
  final num? sortOrder;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateCallOutcomeReasonDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                code,
                label,
                effect,
                requiresComment,
                requiresCallback,
                countsAsReached,
                color,
                sortOrder,
              ],
              [
                other.code,
                other.label,
                other.effect,
                other.requiresComment,
                other.requiresCallback,
                other.countsAsReached,
                other.color,
                other.sortOrder,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        code,
        label,
        effect,
        requiresComment,
        requiresCallback,
        countsAsReached,
        color,
        sortOrder,
      ]);

  factory CreateCallOutcomeReasonDto.fromJson(Map<String, dynamic> json) =>
      _$CreateCallOutcomeReasonDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateCallOutcomeReasonDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
