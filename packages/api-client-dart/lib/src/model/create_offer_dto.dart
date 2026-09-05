//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_offer_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateOfferDto {
  /// Returns a new [CreateOfferDto] instance.
  CreateOfferDto({

    required  this.code,

    required  this.label,

     this.description,

     this.position,

     this.isActive = true,
  });

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
    
    name: r'description',
    required: false,
    includeIfNull: false,
  )


  final String? description;



          // minimum: 0
          // maximum: 9999
  @JsonKey(
    
    name: r'position',
    required: false,
    includeIfNull: false,
  )


  final num? position;



  @JsonKey(
    defaultValue: true,
    name: r'isActive',
    required: false,
    includeIfNull: false,
  )


  final bool? isActive;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is CreateOfferDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            code,
            label,
            description,
            position,
            isActive,
        ],
        [
            other.code,
            other.label,
            other.description,
            other.position,
            other.isActive,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        code,
        label,
        description,
        position,
        isActive,
    ],);

  factory CreateOfferDto.fromJson(Map<String, dynamic> json) => _$CreateOfferDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateOfferDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

