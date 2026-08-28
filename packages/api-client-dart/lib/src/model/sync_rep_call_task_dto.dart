//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/call_task_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_rep_call_task_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncRepCallTaskDto {
  /// Returns a new [SyncRepCallTaskDto] instance.
  SyncRepCallTaskDto({
    required this.id,

    required this.campaignId,

    required this.representantId,

    required this.position,

    required this.dayIndex,

    required this.status,

    required this.isActive,

    required this.updatedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'campaignId', required: true, includeIfNull: false)
  final String campaignId;

  @JsonKey(name: r'representantId', required: true, includeIfNull: false)
  final String representantId;

  /// Rang dans le programme, à partir de 1.
  @JsonKey(name: r'position', required: true, includeIfNull: false)
  final num position;

  /// Journée d’étalement, à partir de 0.
  @JsonKey(name: r'dayIndex', required: true, includeIfNull: false)
  final num dayIndex;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: CallTaskStatus.unknownDefaultOpenApi,
  )
  final CallTaskStatus status;

  /// Voir `SyncCallTaskDto.isActive`.
  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SyncRepCallTaskDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                campaignId,
                representantId,
                position,
                dayIndex,
                status,
                isActive,
                updatedAt,
              ],
              [
                other.id,
                other.campaignId,
                other.representantId,
                other.position,
                other.dayIndex,
                other.status,
                other.isActive,
                other.updatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        campaignId,
        representantId,
        position,
        dayIndex,
        status,
        isActive,
        updatedAt,
      ]);

  factory SyncRepCallTaskDto.fromJson(Map<String, dynamic> json) =>
      _$SyncRepCallTaskDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncRepCallTaskDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
