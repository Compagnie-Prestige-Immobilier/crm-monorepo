//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/supervision_activity_row_dto.dart';
import 'package:crm_api_client/src/model/supervision_rep_statuts_dto.dart';
import 'package:crm_api_client/src/model/supervision_histogram_bar_dto.dart';
import 'package:crm_api_client/src/model/supervision_granularity.dart';
import 'package:crm_api_client/src/model/supervision_score_dto.dart';
import 'package:crm_api_client/src/model/supervision_activity_counts_dto.dart';
import 'package:crm_api_client/src/model/supervision_teleconseiller_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'supervision_activity_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SupervisionActivityDto {
  /// Returns a new [SupervisionActivityDto] instance.
  SupervisionActivityDto({

    required  this.from,

    required  this.to,

    required  this.granularity,

    required  this.items,

    required  this.totals,

    required  this.teleconseillers,

    required  this.scores,

    required  this.prospectsByTeleconseiller,

    required  this.prospectsByRepresentant,

    required  this.repQualificationStatuses,
  });

  @JsonKey(
    
    name: r'from',
    required: true,
    includeIfNull: true,
  )


  final DateTime? from;



  @JsonKey(
    
    name: r'to',
    required: true,
    includeIfNull: true,
  )


  final DateTime? to;



  @JsonKey(
    
    name: r'granularity',
    required: true,
    includeIfNull: false,
  unknownEnumValue: SupervisionGranularity.unknownDefaultOpenApi,
  )


  final SupervisionGranularity granularity;



      /// Une ligne par téléconseiller et par période, seulement là où il s’est passé quelque chose.
  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<SupervisionActivityRowDto> items;



      /// L’équipe entière sur TOUTE la fenêtre, filtres compris. Calculé côté serveur : `representantsContacted`, `repQuestioned` et `repQualified` comptent des personnes distinctes, et la somme des lignes en compterait certaines deux fois.
  @JsonKey(
    
    name: r'totals',
    required: true,
    includeIfNull: false,
  )


  final SupervisionActivityCountsDto totals;



      /// Tous les téléconseillers, y compris ceux sans aucun acte sur la fenêtre.
  @JsonKey(
    
    name: r'teleconseillers',
    required: true,
    includeIfNull: false,
  )


  final List<SupervisionTeleconseillerDto> teleconseillers;



      /// Une note par téléconseiller pour TOUTE la fenêtre, recalculée depuis les appels et la présence : rien n’est figé, corriger la définition corrige l’historique. Vide si le calcul a échoué.
  @JsonKey(
    
    name: r'scores',
    required: true,
    includeIfNull: false,
  )


  final List<SupervisionScoreDto> scores;



      /// Stock courant de prospects rattachés à chaque téléconseiller.
  @JsonKey(
    
    name: r'prospectsByTeleconseiller',
    required: true,
    includeIfNull: false,
  )


  final List<SupervisionHistogramBarDto> prospectsByTeleconseiller;



      /// Stock courant de prospects rattachés à chaque représentant.
  @JsonKey(
    
    name: r'prospectsByRepresentant',
    required: true,
    includeIfNull: false,
  )


  final List<SupervisionHistogramBarDto> prospectsByRepresentant;



      /// Répartition des représentants par statut de qualification, basée sur leur dernier appel portant un statut dans la fenêtre. `null` sans représentant dans la fenêtre.
  @JsonKey(
    
    name: r'repQualificationStatuses',
    required: true,
    includeIfNull: true,
  )


  final SupervisionRepStatutsDto? repQualificationStatuses;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is SupervisionActivityDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            from,
            to,
            granularity,
            items,
            totals,
            teleconseillers,
            scores,
            prospectsByTeleconseiller,
            prospectsByRepresentant,
            repQualificationStatuses,
        ],
        [
            other.from,
            other.to,
            other.granularity,
            other.items,
            other.totals,
            other.teleconseillers,
            other.scores,
            other.prospectsByTeleconseiller,
            other.prospectsByRepresentant,
            other.repQualificationStatuses,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        from,
        to,
        granularity,
        items,
        totals,
        teleconseillers,
        scores,
        prospectsByTeleconseiller,
        prospectsByRepresentant,
        repQualificationStatuses,
    ],);

  factory SupervisionActivityDto.fromJson(Map<String, dynamic> json) => _$SupervisionActivityDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisionActivityDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

