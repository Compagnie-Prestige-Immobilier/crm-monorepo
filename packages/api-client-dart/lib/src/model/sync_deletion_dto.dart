//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/sync_entity.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_deletion_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncDeletionDto {
  /// Returns a new [SyncDeletionDto] instance.
  SyncDeletionDto({
    required this.entity,

    required this.id,

    required this.deletedAt,
  });

  @JsonKey(
    name: r'entity',
    required: true,
    includeIfNull: false,
    unknownEnumValue: SyncEntity.unknownDefaultOpenApi,
  )
  final SyncEntity entity;

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'deletedAt', required: true, includeIfNull: false)
  final DateTime deletedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SyncDeletionDto &&
            runtimeType == other.runtimeType &&
            equals(
              [entity, id, deletedAt],
              [other.entity, other.id, other.deletedAt],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([entity, id, deletedAt]);

  factory SyncDeletionDto.fromJson(Map<String, dynamic> json) =>
      _$SyncDeletionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncDeletionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
