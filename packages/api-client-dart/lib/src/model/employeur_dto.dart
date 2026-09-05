//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/employeur_type.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'employeur_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class EmployeurDto {
  /// Returns a new [EmployeurDto] instance.
  EmployeurDto({

    required  this.id,

    required  this.code,

    required  this.label,

    required  this.type,

    required  this.position,

    required  this.isActive,

    required  this.updatedAt,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



      /// Clé stable, jamais réécrite : les fiches la désignent.
  @JsonKey(
    
    name: r'code',
    required: true,
    includeIfNull: false,
  )


  final String code;



  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'type',
    required: true,
    includeIfNull: false,
  unknownEnumValue: EmployeurType.unknownDefaultOpenApi,
  )


  final EmployeurType type;



  @JsonKey(
    
    name: r'position',
    required: true,
    includeIfNull: false,
  )


  final num position;



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
      other is EmployeurDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            code,
            label,
            type,
            position,
            isActive,
            updatedAt,
        ],
        [
            other.id,
            other.code,
            other.label,
            other.type,
            other.position,
            other.isActive,
            other.updatedAt,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        code,
        label,
        type,
        position,
        isActive,
        updatedAt,
    ],);

  factory EmployeurDto.fromJson(Map<String, dynamic> json) => _$EmployeurDtoFromJson(json);

  Map<String, dynamic> toJson() => _$EmployeurDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

