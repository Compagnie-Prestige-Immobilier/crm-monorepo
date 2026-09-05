//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/purge_deletion_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'purge_result_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PurgeResultDto {
  /// Returns a new [PurgeResultDto] instance.
  PurgeResultDto({

    required  this.deleted,

    required  this.total,

    required  this.purgedAt,
  });

  @JsonKey(
    
    name: r'deleted',
    required: true,
    includeIfNull: false,
  )


  final List<PurgeDeletionDto> deleted;



  @JsonKey(
    
    name: r'total',
    required: true,
    includeIfNull: false,
  )


  final num total;



      /// Horodatage serveur de la purge.
  @JsonKey(
    
    name: r'purgedAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime purgedAt;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is PurgeResultDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            deleted,
            total,
            purgedAt,
        ],
        [
            other.deleted,
            other.total,
            other.purgedAt,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        deleted,
        total,
        purgedAt,
    ],);

  factory PurgeResultDto.fromJson(Map<String, dynamic> json) => _$PurgeResultDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PurgeResultDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

