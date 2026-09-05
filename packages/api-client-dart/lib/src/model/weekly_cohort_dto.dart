//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'weekly_cohort_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class WeeklyCohortDto {
  /// Returns a new [WeeklyCohortDto] instance.
  WeeklyCohortDto({

    required  this.week,

    required  this.prospects,

    required  this.methodObtained,

    required  this.cases,

    required  this.cashed,

    required  this.cashedAmountXof,

    required  this.conversionRate,
  });

      /// Lundi de la semaine d’entrée, au format AAAA-MM-JJ.
  @JsonKey(
    
    name: r'week',
    required: true,
    includeIfNull: false,
  )


  final DateTime week;



      /// Prospects saisis cette semaine-là.
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



      /// Prospects de la cohorte portant un dossier bancaire.
  @JsonKey(
    
    name: r'cases',
    required: true,
    includeIfNull: false,
  )


  final num cases;



      /// Prospects de la cohorte dont un dossier est encaissé.
  @JsonKey(
    
    name: r'cashed',
    required: true,
    includeIfNull: false,
  )


  final num cashed;



      /// Montant encaissé par la cohorte, en francs CFA. Chaîne.
  @JsonKey(
    
    name: r'cashedAmountXof',
    required: true,
    includeIfNull: false,
  )


  final String cashedAmountXof;



      /// Part de la cohorte allée jusqu’à l’encaissement, en pourcentage. Rapportée aux prospects entrés, seule base qui rende deux semaines comparables. Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.
  @JsonKey(
    
    name: r'conversionRate',
    required: true,
    includeIfNull: true,
  )


  final num? conversionRate;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is WeeklyCohortDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            week,
            prospects,
            methodObtained,
            cases,
            cashed,
            cashedAmountXof,
            conversionRate,
        ],
        [
            other.week,
            other.prospects,
            other.methodObtained,
            other.cases,
            other.cashed,
            other.cashedAmountXof,
            other.conversionRate,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        week,
        prospects,
        methodObtained,
        cases,
        cashed,
        cashedAmountXof,
        conversionRate,
    ],);

  factory WeeklyCohortDto.fromJson(Map<String, dynamic> json) => _$WeeklyCohortDtoFromJson(json);

  Map<String, dynamic> toJson() => _$WeeklyCohortDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

