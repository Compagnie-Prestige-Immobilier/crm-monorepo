//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/departement_yield_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'departement_yield_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DepartementYieldListDto {
  /// Returns a new [DepartementYieldListDto] instance.
  DepartementYieldListDto({

    required  this.items,

    required  this.total,
  });

      /// Départements, du plus rentable.
  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<DepartementYieldDto> items;



      /// Prospects tous départements confondus.
  @JsonKey(
    
    name: r'total',
    required: true,
    includeIfNull: false,
  )


  final num total;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is DepartementYieldListDto &&
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

  factory DepartementYieldListDto.fromJson(Map<String, dynamic> json) => _$DepartementYieldListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DepartementYieldListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

