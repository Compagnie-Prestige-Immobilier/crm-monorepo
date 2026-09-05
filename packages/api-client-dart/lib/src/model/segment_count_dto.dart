//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/bdd_segment.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'segment_count_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SegmentCountDto {
  /// Returns a new [SegmentCountDto] instance.
  SegmentCountDto({

    required  this.segment,

    required  this.label,

    required  this.prospects,

    required  this.share,

    required  this.methodObtained,
  });

  @JsonKey(
    
    name: r'segment',
    required: true,
    includeIfNull: false,
  unknownEnumValue: BddSegment.unknownDefaultOpenApi,
  )


  final BddSegment segment;



      /// Libellé partagé, issu de SEGMENT_LABELS.
  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'prospects',
    required: true,
    includeIfNull: false,
  )


  final num prospects;



  @JsonKey(
    
    name: r'share',
    required: true,
    includeIfNull: false,
  )


  final num share;



      /// Prospects du segment avec une méthode obtenue.
  @JsonKey(
    
    name: r'methodObtained',
    required: true,
    includeIfNull: false,
  )


  final num methodObtained;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is SegmentCountDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            segment,
            label,
            prospects,
            share,
            methodObtained,
        ],
        [
            other.segment,
            other.label,
            other.prospects,
            other.share,
            other.methodObtained,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        segment,
        label,
        prospects,
        share,
        methodObtained,
    ],);

  factory SegmentCountDto.fromJson(Map<String, dynamic> json) => _$SegmentCountDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SegmentCountDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

