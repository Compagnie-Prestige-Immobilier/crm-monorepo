//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'segment_conversion_author_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SegmentConversionAuthorDto {
  /// Returns a new [SegmentConversionAuthorDto] instance.
  SegmentConversionAuthorDto({

    required  this.userId,

    required  this.fullName,

    required  this.conversions,
  });

  @JsonKey(
    
    name: r'userId',
    required: true,
    includeIfNull: false,
  )


  final String userId;



  @JsonKey(
    
    name: r'fullName',
    required: true,
    includeIfNull: false,
  )


  final String fullName;



  @JsonKey(
    
    name: r'conversions',
    required: true,
    includeIfNull: false,
  )


  final num conversions;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is SegmentConversionAuthorDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            userId,
            fullName,
            conversions,
        ],
        [
            other.userId,
            other.fullName,
            other.conversions,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        userId,
        fullName,
        conversions,
    ],);

  factory SegmentConversionAuthorDto.fromJson(Map<String, dynamic> json) => _$SegmentConversionAuthorDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SegmentConversionAuthorDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

