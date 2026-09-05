//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'funnel_stage_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class FunnelStageDto {
  /// Returns a new [FunnelStageDto] instance.
  FunnelStageDto({

    required  this.label,

    required  this.count,

    required  this.tauxEtapePrecedente,

    required  this.tauxGlobal,
  });

      /// Nom de l’étape, prêt à afficher.
  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'count',
    required: true,
    includeIfNull: false,
  )


  final num count;



      /// Part de l’étape précédente, en pourcentage. Vaut 100 pour la première. C’est le taux qui montre OÙ la chaîne se casse, et non le taux global qui noie la marche défaillante dans la moyenne. Nul quand l’étape précédente est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.
  @JsonKey(
    
    name: r'tauxEtapePrecedente',
    required: true,
    includeIfNull: true,
  )


  final num? tauxEtapePrecedente;



      /// Part du sommet de l’entonnoir, en pourcentage. Nul quand le sommet est vide.
  @JsonKey(
    
    name: r'tauxGlobal',
    required: true,
    includeIfNull: true,
  )


  final num? tauxGlobal;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is FunnelStageDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            label,
            count,
            tauxEtapePrecedente,
            tauxGlobal,
        ],
        [
            other.label,
            other.count,
            other.tauxEtapePrecedente,
            other.tauxGlobal,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        label,
        count,
        tauxEtapePrecedente,
        tauxGlobal,
    ],);

  factory FunnelStageDto.fromJson(Map<String, dynamic> json) => _$FunnelStageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$FunnelStageDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

