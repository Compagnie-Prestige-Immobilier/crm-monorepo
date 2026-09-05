//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'data_quality_row_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DataQualityRowDto {
  /// Returns a new [DataQualityRowDto] instance.
  DataQualityRowDto({

    required  this.id,

    required  this.label,

    required  this.attempts,

    required  this.unreachable,

    required  this.wrongNumber,

    required  this.badRate,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



      /// Tentatives d’appel observées.
  @JsonKey(
    
    name: r'attempts',
    required: true,
    includeIfNull: false,
  )


  final num attempts;



  @JsonKey(
    
    name: r'unreachable',
    required: true,
    includeIfNull: false,
  )


  final num unreachable;



  @JsonKey(
    
    name: r'wrongNumber',
    required: true,
    includeIfNull: false,
  )


  final num wrongNumber;



      /// Part des tentatives injoignables ou erronées, en pourcentage. Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.
  @JsonKey(
    
    name: r'badRate',
    required: true,
    includeIfNull: true,
  )


  final num? badRate;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is DataQualityRowDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            label,
            attempts,
            unreachable,
            wrongNumber,
            badRate,
        ],
        [
            other.id,
            other.label,
            other.attempts,
            other.unreachable,
            other.wrongNumber,
            other.badRate,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        label,
        attempts,
        unreachable,
        wrongNumber,
        badRate,
    ],);

  factory DataQualityRowDto.fromJson(Map<String, dynamic> json) => _$DataQualityRowDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DataQualityRowDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

