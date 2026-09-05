//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/sync_operation_result_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_push_response_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncPushResponseDto {
  /// Returns a new [SyncPushResponseDto] instance.
  SyncPushResponseDto({

    required  this.batchId,

    required  this.serverTime,

    required  this.results,

    required  this.nextCursor,
  });

  @JsonKey(
    
    name: r'batchId',
    required: true,
    includeIfNull: false,
  )


  final String batchId;



  @JsonKey(
    
    name: r'serverTime',
    required: true,
    includeIfNull: false,
  )


  final DateTime serverTime;



  @JsonKey(
    
    name: r'results',
    required: true,
    includeIfNull: false,
  )


  final List<SyncOperationResultDto> results;



      /// Toujours null : le serveur ignore la position de pull du client, et en fabriquer une lui ferait sauter les écritures des autres appareils. Le client conserve son propre curseur.
  @JsonKey(
    
    name: r'nextCursor',
    required: true,
    includeIfNull: true,
  )


  final String? nextCursor;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is SyncPushResponseDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            batchId,
            serverTime,
            results,
            nextCursor,
        ],
        [
            other.batchId,
            other.serverTime,
            other.results,
            other.nextCursor,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        batchId,
        serverTime,
        results,
        nextCursor,
    ],);

  factory SyncPushResponseDto.fromJson(Map<String, dynamic> json) => _$SyncPushResponseDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncPushResponseDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

