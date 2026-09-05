//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/sync_op_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_operation_result_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncOperationResultDto {
  /// Returns a new [SyncOperationResultDto] instance.
  SyncOperationResultDto({

    required  this.opId,

    required  this.status,

    required  this.entityId,

    required  this.rev,

    required  this.serverUpdatedAt,

    required  this.errorCode,

    required  this.error,
  });

  @JsonKey(
    
    name: r'opId',
    required: true,
    includeIfNull: false,
  )


  final String opId;



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  unknownEnumValue: SyncOpStatus.unknownDefaultOpenApi,
  )


  final SyncOpStatus status;



  @JsonKey(
    
    name: r'entityId',
    required: true,
    includeIfNull: true,
  )


  final String? entityId;



      /// Révision serveur après écriture.
  @JsonKey(
    
    name: r'rev',
    required: true,
    includeIfNull: true,
  )


  final num? rev;



  @JsonKey(
    
    name: r'serverUpdatedAt',
    required: true,
    includeIfNull: true,
  )


  final DateTime? serverUpdatedAt;



      /// Code métier lisible par le client : PROSPECT_PHONE_CONFLICT, REV_CONFLICT, …
  @JsonKey(
    
    name: r'errorCode',
    required: true,
    includeIfNull: true,
  )


  final String? errorCode;



  @JsonKey(
    
    name: r'error',
    required: true,
    includeIfNull: true,
  )


  final String? error;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is SyncOperationResultDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            opId,
            status,
            entityId,
            rev,
            serverUpdatedAt,
            errorCode,
            error,
        ],
        [
            other.opId,
            other.status,
            other.entityId,
            other.rev,
            other.serverUpdatedAt,
            other.errorCode,
            other.error,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        opId,
        status,
        entityId,
        rev,
        serverUpdatedAt,
        errorCode,
        error,
    ],);

  factory SyncOperationResultDto.fromJson(Map<String, dynamic> json) => _$SyncOperationResultDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncOperationResultDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

