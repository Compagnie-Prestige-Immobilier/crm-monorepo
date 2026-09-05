//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/change_source.dart';
import 'package:crm_api_client/src/model/bdd_segment.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'segment_conversion_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SegmentConversionDto {
  /// Returns a new [SegmentConversionDto] instance.
  SegmentConversionDto({

    required  this.id,

    required  this.prospectId,

    required  this.prospectName,

    required  this.fromSegment,

    required  this.toSegment,

    required  this.reason,

    required  this.changedById,

    required  this.changedByName,

    required  this.source_,

    required  this.changedAt,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'prospectId',
    required: true,
    includeIfNull: false,
  )


  final String prospectId;



      /// Prénom et nom de la fiche convertie, au moment de la lecture.
  @JsonKey(
    
    name: r'prospectName',
    required: true,
    includeIfNull: false,
  )


  final String prospectName;



  @JsonKey(
    
    name: r'fromSegment',
    required: true,
    includeIfNull: false,
  unknownEnumValue: BddSegment.unknownDefaultOpenApi,
  )


  final BddSegment fromSegment;



  @JsonKey(
    
    name: r'toSegment',
    required: true,
    includeIfNull: false,
  unknownEnumValue: BddSegment.unknownDefaultOpenApi,
  )


  final BddSegment toSegment;



  @JsonKey(
    
    name: r'reason',
    required: true,
    includeIfNull: true,
  )


  final String? reason;



  @JsonKey(
    
    name: r'changedById',
    required: true,
    includeIfNull: false,
  )


  final String changedById;



  @JsonKey(
    
    name: r'changedByName',
    required: true,
    includeIfNull: false,
  )


  final String changedByName;



  @JsonKey(
    
    name: r'source',
    required: true,
    includeIfNull: false,
  unknownEnumValue: ChangeSource.unknownDefaultOpenApi,
  )


  final ChangeSource source_;



  @JsonKey(
    
    name: r'changedAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime changedAt;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is SegmentConversionDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            prospectId,
            prospectName,
            fromSegment,
            toSegment,
            reason,
            changedById,
            changedByName,
            source_,
            changedAt,
        ],
        [
            other.id,
            other.prospectId,
            other.prospectName,
            other.fromSegment,
            other.toSegment,
            other.reason,
            other.changedById,
            other.changedByName,
            other.source_,
            other.changedAt,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        prospectId,
        prospectName,
        fromSegment,
        toSegment,
        reason,
        changedById,
        changedByName,
        source_,
        changedAt,
    ],);

  factory SegmentConversionDto.fromJson(Map<String, dynamic> json) => _$SegmentConversionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SegmentConversionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

