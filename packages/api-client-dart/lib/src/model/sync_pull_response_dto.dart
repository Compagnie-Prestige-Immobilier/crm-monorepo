//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/sync_deletion_dto.dart';
import 'package:crm_api_client/src/model/sync_changes_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_pull_response_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncPullResponseDto {
  /// Returns a new [SyncPullResponseDto] instance.
  SyncPullResponseDto({

    required  this.changes,

    required  this.deletions,

    required  this.nextCursor,

    required  this.hasMore,

    required  this.serverTime,
  });

  @JsonKey(
    
    name: r'changes',
    required: true,
    includeIfNull: false,
  )


  final SyncChangesDto changes;



  @JsonKey(
    
    name: r'deletions',
    required: true,
    includeIfNull: false,
  )


  final List<SyncDeletionDto> deletions;



      /// À renvoyer tel quel dans le prochain appel.
  @JsonKey(
    
    name: r'nextCursor',
    required: true,
    includeIfNull: false,
  )


  final String nextCursor;



      /// Vrai si au moins un flux a d’autres pages.
  @JsonKey(
    
    name: r'hasMore',
    required: true,
    includeIfNull: false,
  )


  final bool hasMore;



  @JsonKey(
    
    name: r'serverTime',
    required: true,
    includeIfNull: false,
  )


  final DateTime serverTime;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is SyncPullResponseDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            changes,
            deletions,
            nextCursor,
            hasMore,
            serverTime,
        ],
        [
            other.changes,
            other.deletions,
            other.nextCursor,
            other.hasMore,
            other.serverTime,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        changes,
        deletions,
        nextCursor,
        hasMore,
        serverTime,
    ],);

  factory SyncPullResponseDto.fromJson(Map<String, dynamic> json) => _$SyncPullResponseDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncPullResponseDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

