//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/page_meta_dto.dart';
import 'package:crm_api_client/src/model/prospect_search_item_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'prospect_search_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProspectSearchListDto {
  /// Returns a new [ProspectSearchListDto] instance.
  ProspectSearchListDto({

    required  this.items,

    required  this.meta,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<ProspectSearchItemDto> items;



  @JsonKey(
    
    name: r'meta',
    required: true,
    includeIfNull: false,
  )


  final PageMetaDto meta;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is ProspectSearchListDto &&
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

  factory ProspectSearchListDto.fromJson(Map<String, dynamic> json) => _$ProspectSearchListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ProspectSearchListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

