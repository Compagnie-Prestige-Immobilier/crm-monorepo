//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'banque_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BanqueDto {
  /// Returns a new [BanqueDto] instance.
  BanqueDto({

    required  this.id,

    required  this.name,

    required  this.shortName,

    required  this.isActive,

    required  this.sortOrder,

    required  this.updatedAt,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'shortName',
    required: true,
    includeIfNull: false,
  )


  final String shortName;



  @JsonKey(
    
    name: r'isActive',
    required: true,
    includeIfNull: false,
  )


  final bool isActive;



  @JsonKey(
    
    name: r'sortOrder',
    required: true,
    includeIfNull: false,
  )


  final num sortOrder;



  @JsonKey(
    
    name: r'updatedAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime updatedAt;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is BanqueDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            name,
            shortName,
            isActive,
            sortOrder,
            updatedAt,
        ],
        [
            other.id,
            other.name,
            other.shortName,
            other.isActive,
            other.sortOrder,
            other.updatedAt,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        name,
        shortName,
        isActive,
        sortOrder,
        updatedAt,
    ],);

  factory BanqueDto.fromJson(Map<String, dynamic> json) => _$BanqueDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BanqueDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

