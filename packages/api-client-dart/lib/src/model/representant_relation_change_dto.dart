//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/change_source.dart';
import 'package:crm_api_client/src/model/representant_relation.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_relation_change_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantRelationChangeDto {
  /// Returns a new [RepresentantRelationChangeDto] instance.
  RepresentantRelationChangeDto({
    required this.id,

    required this.representantId,

    required this.fromStatus,

    required this.toStatus,

    required this.reason,

    required this.changedById,

    required this.changedByName,

    required this.source_,

    required this.changedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'representantId', required: true, includeIfNull: false)
  final String representantId;

  @JsonKey(
    name: r'fromStatus',
    required: true,
    includeIfNull: false,
    unknownEnumValue: RepresentantRelation.unknownDefaultOpenApi,
  )
  final RepresentantRelation fromStatus;

  @JsonKey(
    name: r'toStatus',
    required: true,
    includeIfNull: false,
    unknownEnumValue: RepresentantRelation.unknownDefaultOpenApi,
  )
  final RepresentantRelation toStatus;

  @JsonKey(name: r'reason', required: true, includeIfNull: true)
  final String? reason;

  @JsonKey(name: r'changedById', required: true, includeIfNull: false)
  final String changedById;

  @JsonKey(name: r'changedByName', required: true, includeIfNull: false)
  final String changedByName;

  /// Le canal qui a écrit la bascule.
  @JsonKey(
    name: r'source',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ChangeSource.unknownDefaultOpenApi,
  )
  final ChangeSource source_;

  @JsonKey(name: r'changedAt', required: true, includeIfNull: false)
  final DateTime changedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepresentantRelationChangeDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                representantId,
                fromStatus,
                toStatus,
                reason,
                changedById,
                changedByName,
                source_,
                changedAt,
              ],
              [
                other.id,
                other.representantId,
                other.fromStatus,
                other.toStatus,
                other.reason,
                other.changedById,
                other.changedByName,
                other.source_,
                other.changedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        representantId,
        fromStatus,
        toStatus,
        reason,
        changedById,
        changedByName,
        source_,
        changedAt,
      ]);

  factory RepresentantRelationChangeDto.fromJson(Map<String, dynamic> json) =>
      _$RepresentantRelationChangeDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantRelationChangeDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
