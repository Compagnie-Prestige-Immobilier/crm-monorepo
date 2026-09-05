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

    this.pendingOps,

    this.appVersion,
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

  /// Opérations restant dans la file d’attente de l’appareil APRÈS ce lot. Le serveur ne peut pas la deviner. Facultatif sans limite de temps : une version déjà déployée ne l’envoie pas.
  // minimum: 0
  @JsonKey(name: r'pendingOps', required: false, includeIfNull: false)
  final num? pendingOps;

  /// Version de l’application mobile, telle qu’elle s’annonce. Facultative.
  @JsonKey(name: r'appVersion', required: false, includeIfNull: false)
  final String? appVersion;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SyncPushDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                clientBatchId,
                payloadVersion,
                operations,
                pendingOps,
                appVersion,
              ],
              [
                other.clientBatchId,
                other.payloadVersion,
                other.operations,
                other.pendingOps,
                other.appVersion,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        clientBatchId,
        payloadVersion,
        operations,
        pendingOps,
        appVersion,
      ]);

  factory SyncPushDto.fromJson(Map<String, dynamic> json) =>
      _$SyncPushDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncPushDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
