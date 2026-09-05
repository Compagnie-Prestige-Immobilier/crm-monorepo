//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/page_meta_dto.dart';
import 'package:crm_api_client/src/model/representant_comment_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_comment_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantCommentListDto {
  /// Returns a new [RepresentantCommentListDto] instance.
  RepresentantCommentListDto({

    required  this.items,

    required  this.meta,
  });

      /// Du plus récent au plus ancien.
  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<RepresentantCommentDto> items;



  @JsonKey(
    
    name: r'meta',
    required: true,
    includeIfNull: false,
  )


  final PageMetaDto meta;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is RepresentantCommentListDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            items,
            meta,
        ],
        [
            other.items,
            other.meta,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        items,
        meta,
    ],);

  factory RepresentantCommentListDto.fromJson(Map<String, dynamic> json) => _$RepresentantCommentListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantCommentListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

