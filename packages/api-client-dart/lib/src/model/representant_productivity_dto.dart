//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_productivity_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantProductivityDto {
  /// Returns a new [RepresentantProductivityDto] instance.
  RepresentantProductivityDto({

    required  this.id,

    required  this.label,

    required  this.departementName,

    required  this.prospects,

    required  this.methodObtained,

    required  this.conversionRate,

    required  this.lastProspectAt,

    required  this.dormant,
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



  @JsonKey(
    
    name: r'departementName',
    required: true,
    includeIfNull: false,
  )


  final String departementName;



  @JsonKey(
    
    name: r'prospects',
    required: true,
    includeIfNull: false,
  )


  final num prospects;



  @JsonKey(
    
    name: r'methodObtained',
    required: true,
    includeIfNull: false,
  )


  final num methodObtained;



      /// Méthodes obtenues rapportées aux prospects apportés, en pourcentage. Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.
  @JsonKey(
    
    name: r'conversionRate',
    required: true,
    includeIfNull: true,
  )


  final num? conversionRate;



      /// Dernier apport, à la date de saisie terrain.
  @JsonKey(
    
    name: r'lastProspectAt',
    required: true,
    includeIfNull: true,
  )


  final DateTime? lastProspectAt;



      /// Aucun apport depuis le seuil demandé. Calculé en base, jamais côté client.
  @JsonKey(
    
    name: r'dormant',
    required: true,
    includeIfNull: false,
  )


  final bool dormant;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is RepresentantProductivityDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            label,
            departementName,
            prospects,
            methodObtained,
            conversionRate,
            lastProspectAt,
            dormant,
        ],
        [
            other.id,
            other.label,
            other.departementName,
            other.prospects,
            other.methodObtained,
            other.conversionRate,
            other.lastProspectAt,
            other.dormant,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        label,
        departementName,
        prospects,
        methodObtained,
        conversionRate,
        lastProspectAt,
        dormant,
    ],);

  factory RepresentantProductivityDto.fromJson(Map<String, dynamic> json) => _$RepresentantProductivityDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantProductivityDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

