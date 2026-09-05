//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/score_part.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'performance_score.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PerformanceScore {
  /// Returns a new [PerformanceScore] instance.
  PerformanceScore({

    required  this.value,

    required  this.reason,

    required  this.parts,
  });

      /// Note de 0 à 100 sur la fenêtre mesurée. `null` quand rien ne peut être jugé : `reason` dit alors pourquoi, et l’écran affiche le motif au lieu d’un zéro.
  @JsonKey(
    
    name: r'value',
    required: true,
    includeIfNull: true,
  )


  final num? value;



  @JsonKey(
    
    name: r'reason',
    required: true,
    includeIfNull: true,
  unknownEnumValue: PerformanceScoreReasonEnum.unknownDefaultOpenApi,
  )


  final PerformanceScoreReasonEnum? reason;



      /// Le détail qui compose la note. Vide quand `value` est nulle.
  @JsonKey(
    
    name: r'parts',
    required: true,
    includeIfNull: false,
  )


  final List<ScorePart> parts;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is PerformanceScore &&
      runtimeType == other.runtimeType &&
      equals(
        [
            value,
            reason,
            parts,
        ],
        [
            other.value,
            other.reason,
            other.parts,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        value,
        reason,
        parts,
    ],);

  factory PerformanceScore.fromJson(Map<String, dynamic> json) => _$PerformanceScoreFromJson(json);

  Map<String, dynamic> toJson() => _$PerformanceScoreToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum PerformanceScoreReasonEnum {
@JsonValue(r'journee_non_commencee')
journeeNonCommencee(r'journee_non_commencee'),
@JsonValue(r'presence_non_mesuree')
presenceNonMesuree(r'presence_non_mesuree'),
@JsonValue(r'aucun_appel')
aucunAppel(r'aucun_appel'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const PerformanceScoreReasonEnum(this.value);

final String value;

@override
String toString() => value;
}


