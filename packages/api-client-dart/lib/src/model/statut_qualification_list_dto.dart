//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/statut_qualification_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'statut_qualification_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StatutQualificationListDto {
  /// Returns a new [StatutQualificationListDto] instance.
  StatutQualificationListDto({

    required  this.items,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<StatutQualificationDto> items;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is StatutQualificationListDto &&
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

  factory StatutQualificationListDto.fromJson(Map<String, dynamic> json) => _$StatutQualificationListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$StatutQualificationListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

