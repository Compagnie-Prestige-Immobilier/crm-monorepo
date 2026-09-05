//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/bdd_segment.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'segment_conversion_origin_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SegmentConversionOriginDto {
  /// Returns a new [SegmentConversionOriginDto] instance.
  SegmentConversionOriginDto({

    required  this.segment,

    required  this.conversions,
  });

  @JsonKey(
    
    name: r'segment',
    required: true,
    includeIfNull: false,
  unknownEnumValue: BddSegment.unknownDefaultOpenApi,
  )


  final BddSegment segment;



  @JsonKey(
    
    name: r'conversions',
    required: true,
    includeIfNull: false,
  )


  final num conversions;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is SegmentConversionOriginDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            segment,
            conversions,
        ],
        [
            other.segment,
            other.conversions,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        segment,
        conversions,
    ],);

  factory SegmentConversionOriginDto.fromJson(Map<String, dynamic> json) => _$SegmentConversionOriginDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SegmentConversionOriginDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

