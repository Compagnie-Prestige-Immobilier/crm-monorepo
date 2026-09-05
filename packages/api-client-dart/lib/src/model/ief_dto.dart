//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'ief_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class IefDto {
  /// Returns a new [IefDto] instance.
  IefDto({

    required  this.id,

    required  this.code,

    required  this.name,

    required  this.departementId,

    required  this.departementName,

    required  this.regionName,

    required  this.isActive,

    required  this.updatedAt,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



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
    
    name: r'departementId',
    required: true,
    includeIfNull: false,
  )


  final String departementId;



  @JsonKey(
    
    name: r'departementName',
    required: true,
    includeIfNull: false,
  )


  final String departementName;



  @JsonKey(
    
    name: r'regionName',
    required: true,
    includeIfNull: false,
  )


  final String regionName;



  @JsonKey(
    
    name: r'isActive',
    required: true,
    includeIfNull: false,
  )


  final bool isActive;



  @JsonKey(
    
    name: r'updatedAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime updatedAt;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is IefDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            code,
            name,
            departementId,
            departementName,
            regionName,
            isActive,
            updatedAt,
        ],
        [
            other.id,
            other.code,
            other.name,
            other.departementId,
            other.departementName,
            other.regionName,
            other.isActive,
            other.updatedAt,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        code,
        name,
        departementId,
        departementName,
        regionName,
        isActive,
        updatedAt,
    ],);

  factory IefDto.fromJson(Map<String, dynamic> json) => _$IefDtoFromJson(json);

  Map<String, dynamic> toJson() => _$IefDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

