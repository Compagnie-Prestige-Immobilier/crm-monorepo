//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/page_meta_dto.dart';
import 'package:crm_api_client/src/model/segment_conversion_origin_dto.dart';
import 'package:crm_api_client/src/model/segment_conversion_dto.dart';
import 'package:crm_api_client/src/model/segment_conversion_author_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'segment_conversion_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SegmentConversionListDto {
  /// Returns a new [SegmentConversionListDto] instance.
  SegmentConversionListDto({

    required  this.items,

    required  this.meta,

    required  this.byOriginSegment,

    required  this.byAuthor,
  });

      /// De la plus récente à la plus ancienne.
  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<SegmentConversionDto> items;



  @JsonKey(
    
    name: r'meta',
    required: true,
    includeIfNull: false,
  )


  final PageMetaDto meta;



  @JsonKey(
    
    name: r'byOriginSegment',
    required: true,
    includeIfNull: false,
  )


  final List<SegmentConversionOriginDto> byOriginSegment;



  @JsonKey(
    
    name: r'byAuthor',
    required: true,
    includeIfNull: false,
  )


  final List<SegmentConversionAuthorDto> byAuthor;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is SegmentConversionListDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            items,
            meta,
            byOriginSegment,
            byAuthor,
        ],
        [
            other.items,
            other.meta,
            other.byOriginSegment,
            other.byAuthor,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        items,
        meta,
        byOriginSegment,
        byAuthor,
    ],);

  factory SegmentConversionListDto.fromJson(Map<String, dynamic> json) => _$SegmentConversionListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SegmentConversionListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

