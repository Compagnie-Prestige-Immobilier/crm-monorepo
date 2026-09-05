//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'score_part.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ScorePart {
  /// Returns a new [ScorePart] instance.
  ScorePart({

    required  this.key,

    required  this.label,

    required  this.ratio,

    required  this.weight,
  });

  @JsonKey(
    
    name: r'key',
    required: true,
    includeIfNull: false,
  unknownEnumValue: ScorePartKeyEnum.unknownDefaultOpenApi,
  )


  final ScorePartKeyEnum key;



  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



      /// Atteinte de la cible, de 0 à 1, plafonnée à 1.
  @JsonKey(
    
    name: r'ratio',
    required: true,
    includeIfNull: false,
  )


  final num ratio;



      /// Part de la note portée par ce critère.
  @JsonKey(
    
    name: r'weight',
    required: true,
    includeIfNull: false,
  )


  final num weight;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is ScorePart &&
      runtimeType == other.runtimeType &&
      equals(
        [
            key,
            label,
            ratio,
            weight,
        ],
        [
            other.key,
            other.label,
            other.ratio,
            other.weight,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        key,
        label,
        ratio,
        weight,
    ],);

  factory ScorePart.fromJson(Map<String, dynamic> json) => _$ScorePartFromJson(json);

  Map<String, dynamic> toJson() => _$ScorePartToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum ScorePartKeyEnum {
@JsonValue(r'assiduite')
assiduite(r'assiduite'),
@JsonValue(r'regularite')
regularite(r'regularite'),
@JsonValue(r'rythme')
rythme(r'rythme'),
@JsonValue(r'contact')
contact(r'contact'),
@JsonValue(r'qualification')
qualification(r'qualification'),
@JsonValue(r'efficience')
efficience(r'efficience'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const ScorePartKeyEnum(this.value);

final String value;

@override
String toString() => value;
}


