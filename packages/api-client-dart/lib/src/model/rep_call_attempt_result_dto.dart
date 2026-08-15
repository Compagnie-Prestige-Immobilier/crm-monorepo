//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/rep_call_attempt_apply_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'rep_call_attempt_result_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepCallAttemptResultDto {
  /// Returns a new [RepCallAttemptResultDto] instance.
  RepCallAttemptResultDto({
    required this.status,

    required this.attemptId,

    required this.taskId,

    required this.taskClosed,
  });

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: RepCallAttemptApplyStatus.unknownDefaultOpenApi,
  )
  final RepCallAttemptApplyStatus status;

  @JsonKey(name: r'attemptId', required: true, includeIfNull: false)
  final String attemptId;

  /// Tâche close par cette tentative, si le représentant en avait une active.
  @JsonKey(name: r'taskId', required: true, includeIfNull: true)
  final String? taskId;

  /// Vrai si l’issue a clos la tâche. Les issues « à rappeler » la laissent ouverte.
  @JsonKey(name: r'taskClosed', required: true, includeIfNull: false)
  final bool taskClosed;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepCallAttemptResultDto &&
            runtimeType == other.runtimeType &&
            equals(
              [status, attemptId, taskId, taskClosed],
              [other.status, other.attemptId, other.taskId, other.taskClosed],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([status, attemptId, taskId, taskClosed]);

  factory RepCallAttemptResultDto.fromJson(Map<String, dynamic> json) =>
      _$RepCallAttemptResultDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepCallAttemptResultDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
