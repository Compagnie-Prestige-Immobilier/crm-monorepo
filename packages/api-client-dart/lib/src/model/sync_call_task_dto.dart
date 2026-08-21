//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/call_task_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_call_task_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncCallTaskDto {
  /// Returns a new [SyncCallTaskDto] instance.
  SyncCallTaskDto({
    required this.id,

    required this.campaignId,

    required this.prospectId,

    required this.position,

    required this.dayIndex,

    required this.status,

    required this.updatedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'campaignId', required: true, includeIfNull: false)
  final String campaignId;

  @JsonKey(name: r'prospectId', required: true, includeIfNull: false)
  final String prospectId;

  /// Rang dans le programme, a partir de 1.
  @JsonKey(name: r'position', required: true, includeIfNull: false)
  final num position;

  /// Journee d’etalement, a partir de 0.
  @JsonKey(name: r'dayIndex', required: true, includeIfNull: false)
  final num dayIndex;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: CallTaskStatus.unknownDefaultOpenApi,
  )
  final CallTaskStatus status;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SyncCallTaskDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                campaignId,
                prospectId,
                position,
                dayIndex,
                status,
                updatedAt,
              ],
              [
                other.id,
                other.campaignId,
                other.prospectId,
                other.position,
                other.dayIndex,
                other.status,
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
        prospectId,
        position,
        dayIndex,
        status,
        updatedAt,
      ]);

  factory SyncCallTaskDto.fromJson(Map<String, dynamic> json) =>
      _$SyncCallTaskDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncCallTaskDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
