//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/sync_operation_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_push_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncPushDto {
  /// Returns a new [SyncPushDto] instance.
  SyncPushDto({
    required this.clientBatchId,

    required this.payloadVersion,

    required this.operations,
  });

  /// Identifiant du lot. Doit être répété à l’identique dans l’en-tête Idempotency-Key.
  @JsonKey(name: r'clientBatchId', required: true, includeIfNull: false)
  final String clientBatchId;

  /// Version du format de charge utile.
  // minimum: 1
  @JsonKey(name: r'payloadVersion', required: true, includeIfNull: false)
  final num payloadVersion;

  @JsonKey(name: r'operations', required: true, includeIfNull: false)
  final List<SyncOperationDto> operations;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SyncPushDto &&
            runtimeType == other.runtimeType &&
            equals(
              [clientBatchId, payloadVersion, operations],
              [other.clientBatchId, other.payloadVersion, other.operations],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([clientBatchId, payloadVersion, operations]);

  factory SyncPushDto.fromJson(Map<String, dynamic> json) =>
      _$SyncPushDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncPushDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
