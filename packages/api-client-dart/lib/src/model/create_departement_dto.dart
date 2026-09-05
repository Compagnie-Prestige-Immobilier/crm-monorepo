//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_departement_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateDepartementDto {
  /// Returns a new [CreateDepartementDto] instance.
  CreateDepartementDto({

    required  this.code,

    required  this.name,

    required  this.regionId,

     this.isActive = true,
  });

      /// Code administratif, unique.
  @JsonKey(
    
    name: r'code',
    required: true,
    includeIfNull: false,
  )


  final String code;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'regionId',
    required: true,
    includeIfNull: false,
  )


  final String regionId;



  @JsonKey(
    defaultValue: true,
    name: r'isActive',
    required: false,
    includeIfNull: false,
  )


  final bool? isActive;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is CreateDepartementDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            code,
            name,
            regionId,
            isActive,
        ],
        [
            other.code,
            other.name,
            other.regionId,
            other.isActive,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        code,
        name,
        regionId,
        isActive,
    ],);

  factory CreateDepartementDto.fromJson(Map<String, dynamic> json) => _$CreateDepartementDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateDepartementDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

