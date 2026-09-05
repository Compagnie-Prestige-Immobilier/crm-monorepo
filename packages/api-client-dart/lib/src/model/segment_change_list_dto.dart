//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/segment_change_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'segment_change_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SegmentChangeListDto {
  /// Returns a new [SegmentChangeListDto] instance.
  SegmentChangeListDto({

    required  this.items,
  });

      /// De la plus récente à la plus ancienne.
  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<SegmentChangeDto> items;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is SegmentChangeListDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            items,
        ],
        [
            other.items,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        items,
    ],);

  factory SegmentChangeListDto.fromJson(Map<String, dynamic> json) => _$SegmentChangeListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SegmentChangeListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

