//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/phase2_status_count_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'phase2_status_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Phase2StatusListDto {
  /// Returns a new [Phase2StatusListDto] instance.
  Phase2StatusListDto({

    required  this.items,

    required  this.total,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<Phase2StatusCountDto> items;



  @JsonKey(
    
    name: r'total',
    required: true,
    includeIfNull: false,
  )


  final num total;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is Phase2StatusListDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            items,
            total,
        ],
        [
            other.items,
            other.total,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        items,
        total,
    ],);

  factory Phase2StatusListDto.fromJson(Map<String, dynamic> json) => _$Phase2StatusListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$Phase2StatusListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

