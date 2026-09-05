//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_syndicat_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateSyndicatDto {
  /// Returns a new [CreateSyndicatDto] instance.
  CreateSyndicatDto({

    required  this.name,

    required  this.sigle,

     this.secteur,

     this.isActive = true,

     this.sortOrder = 100,
  });

  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'sigle',
    required: true,
    includeIfNull: false,
  )


  final String sigle;



  @JsonKey(
    
    name: r'secteur',
    required: false,
    includeIfNull: false,
  )


  final String? secteur;



  @JsonKey(
    defaultValue: true,
    name: r'isActive',
    required: false,
    includeIfNull: false,
  )


  final bool? isActive;



  @JsonKey(
    defaultValue: 100,
    name: r'sortOrder',
    required: false,
    includeIfNull: false,
  )


  final num? sortOrder;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is CreateSyndicatDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            name,
            sigle,
            secteur,
            isActive,
            sortOrder,
        ],
        [
            other.name,
            other.sigle,
            other.secteur,
            other.isActive,
            other.sortOrder,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        name,
        sigle,
        secteur,
        isActive,
        sortOrder,
    ],);

  factory CreateSyndicatDto.fromJson(Map<String, dynamic> json) => _$CreateSyndicatDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateSyndicatDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

