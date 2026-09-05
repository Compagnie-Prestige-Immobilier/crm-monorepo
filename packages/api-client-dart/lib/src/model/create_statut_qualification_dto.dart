//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/priorite_traitement.dart';
import 'package:crm_api_client/src/model/representant_relation.dart';
import 'package:crm_api_client/src/model/statut_qualification_effect.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_statut_qualification_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateStatutQualificationDto {
  /// Returns a new [CreateStatutQualificationDto] instance.
  CreateStatutQualificationDto({

    required  this.label,

    required  this.effect,

     this.requiresCallback = false,

     this.requiresComment = false,

     this.retryAfterMinutes,

     this.priorite = PrioriteTraitement.NORMALE,

     this.relationStatus,
  });

      /// Le code en est déduit, puis figé : majuscules, sans accents, espaces en tirets bas.
  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'effect',
    required: true,
    includeIfNull: false,
  unknownEnumValue: StatutQualificationEffect.unknownDefaultOpenApi,
  )


  final StatutQualificationEffect effect;



  @JsonKey(
    defaultValue: false,
    name: r'requiresCallback',
    required: false,
    includeIfNull: false,
  )


  final bool? requiresCallback;



  @JsonKey(
    defaultValue: false,
    name: r'requiresComment',
    required: false,
    includeIfNull: false,
  )


  final bool? requiresComment;



          // minimum: 5
          // maximum: 10080
  @JsonKey(
    
    name: r'retryAfterMinutes',
    required: false,
    includeIfNull: false,
  )


  final num? retryAfterMinutes;



  @JsonKey(
    defaultValue: PrioriteTraitement.NORMALE,
    name: r'priorite',
    required: false,
    includeIfNull: false,
  unknownEnumValue: PrioriteTraitement.unknownDefaultOpenApi,
  )


  final PrioriteTraitement? priorite;



      /// Relation posée sur la fiche quand le client n’en envoie pas.
  @JsonKey(
    
    name: r'relationStatus',
    required: false,
    includeIfNull: false,
  unknownEnumValue: RepresentantRelation.unknownDefaultOpenApi,
  )


  final RepresentantRelation? relationStatus;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is CreateStatutQualificationDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            label,
            effect,
            requiresCallback,
            requiresComment,
            retryAfterMinutes,
            priorite,
            relationStatus,
        ],
        [
            other.label,
            other.effect,
            other.requiresCallback,
            other.requiresComment,
            other.retryAfterMinutes,
            other.priorite,
            other.relationStatus,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        label,
        effect,
        requiresCallback,
        requiresComment,
        retryAfterMinutes,
        priorite,
        relationStatus,
    ],);

  factory CreateStatutQualificationDto.fromJson(Map<String, dynamic> json) => _$CreateStatutQualificationDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateStatutQualificationDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

