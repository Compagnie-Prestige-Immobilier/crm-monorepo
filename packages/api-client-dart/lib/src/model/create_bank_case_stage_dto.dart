//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_bank_case_stage_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateBankCaseStageDto {
  /// Returns a new [CreateBankCaseStageDto] instance.
  CreateBankCaseStageDto({

    required  this.code,

    required  this.label,

    required  this.color,

     this.position,
  });

      /// Code stable en majuscules. Ne change jamais après création.
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



      /// Rôle du design system, pas un hex.
  @JsonKey(
    
    name: r'color',
    required: true,
    includeIfNull: false,
  )


  final String color;



      /// Position dans le flux ouvert. Défaut : après la dernière étape ouverte. 100 et 101 sont réservées aux étapes système.
          // minimum: 1
          // maximum: 99
  @JsonKey(
    
    name: r'position',
    required: false,
    includeIfNull: false,
  )


  final num? position;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is CreateBankCaseStageDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            code,
            label,
            color,
            position,
        ],
        [
            other.code,
            other.label,
            other.color,
            other.position,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        code,
        label,
        color,
        position,
    ],);

  factory CreateBankCaseStageDto.fromJson(Map<String, dynamic> json) => _$CreateBankCaseStageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateBankCaseStageDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

