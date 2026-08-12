//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/sync_entity.dart';
import 'package:crm_api_client/src/model/sync_entity_data_dto.dart';
import 'package:crm_api_client/src/model/sync_op.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_operation_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncOperationDto {
  /// Returns a new [SyncOperationDto] instance.
  SyncOperationDto({
    required this.opId,

    required this.seq,

    required this.entity,

    required this.op,

    required this.entityId,

    required this.clientUpdatedAt,

    this.baseRev,

    this.data,
  });

  /// Identifiant unique de l’opération, stable entre deux rejeux.
  @JsonKey(name: r'opId', required: true, includeIfNull: false)
  final String opId;

  /// Ordre d’application voulu par le client.
  // minimum: 0
  @JsonKey(name: r'seq', required: true, includeIfNull: false)
  final num seq;

  @JsonKey(
    name: r'entity',
    required: true,
    includeIfNull: false,
    unknownEnumValue: SyncEntity.unknownDefaultOpenApi,
  )
  final SyncEntity entity;

  @JsonKey(
    name: r'op',
    required: true,
    includeIfNull: false,
    unknownEnumValue: SyncOp.unknownDefaultOpenApi,
  )
  final SyncOp op;

  /// Identifiant de la ligne visée, généré par le client.
  @JsonKey(name: r'entityId', required: true, includeIfNull: false)
  final String entityId;

  @JsonKey(name: r'clientUpdatedAt', required: true, includeIfNull: false)
  final DateTime clientUpdatedAt;

  /// Révision serveur sur laquelle le client s’est basé. Fournie sur update/delete, elle transforme une écriture aveugle en écriture conditionnelle.
  @JsonKey(name: r'baseRev', required: false, includeIfNull: false)
  final num? baseRev;

  @JsonKey(name: r'data', required: false, includeIfNull: false)
  final SyncEntityDataDto? data;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SyncOperationDto &&
            runtimeType == other.runtimeType &&
            equals(
              [opId, seq, entity, op, entityId, clientUpdatedAt, baseRev, data],
              [
                other.opId,
                other.seq,
                other.entity,
                other.op,
                other.entityId,
                other.clientUpdatedAt,
                other.baseRev,
                other.data,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        opId,
        seq,
        entity,
        op,
        entityId,
        clientUpdatedAt,
        baseRev,
        data,
      ]);

  factory SyncOperationDto.fromJson(Map<String, dynamic> json) =>
      _$SyncOperationDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncOperationDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
