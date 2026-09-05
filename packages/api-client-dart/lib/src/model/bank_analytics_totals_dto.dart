//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_analytics_totals_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankAnalyticsTotalsDto {
  /// Returns a new [BankAnalyticsTotalsDto] instance.
  BankAnalyticsTotalsDto({

    required  this.total,

    required  this.aTraiter,

    required  this.enTraitement,

    required  this.encaisses,

    required  this.rejetes,

    required  this.totalAmountCashed,

    required  this.rejectionRate,

    required  this.meanDelayHours,
  });

  @JsonKey(
    
    name: r'total',
    required: true,
    includeIfNull: false,
  )


  final num total;



      /// Dossiers sur l’étape initiale.
  @JsonKey(
    
    name: r'aTraiter',
    required: true,
    includeIfNull: false,
  )


  final num aTraiter;



      /// Dossiers sur une étape ouverte non initiale.
  @JsonKey(
    
    name: r'enTraitement',
    required: true,
    includeIfNull: false,
  )


  final num enTraitement;



  @JsonKey(
    
    name: r'encaisses',
    required: true,
    includeIfNull: false,
  )


  final num encaisses;



  @JsonKey(
    
    name: r'rejetes',
    required: true,
    includeIfNull: false,
  )


  final num rejetes;



      /// Somme encaissée, en chaîne. FCFA entiers.
  @JsonKey(
    
    name: r'totalAmountCashed',
    required: true,
    includeIfNull: false,
  )


  final String totalAmountCashed;



      /// Rejetés / (encaissés + rejetés), en pourcentage arrondi au dixième. 0 sans issue.
  @JsonKey(
    
    name: r'rejectionRate',
    required: true,
    includeIfNull: false,
  )


  final num rejectionRate;



      /// Délai moyen en heures entre la création et l’entrée en étape terminale. Nul tant qu’aucun dossier n’est clos.
  @JsonKey(
    
    name: r'meanDelayHours',
    required: true,
    includeIfNull: true,
  )


  final num? meanDelayHours;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is BankAnalyticsTotalsDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            total,
            aTraiter,
            enTraitement,
            encaisses,
            rejetes,
            totalAmountCashed,
            rejectionRate,
            meanDelayHours,
        ],
        [
            other.total,
            other.aTraiter,
            other.enTraitement,
            other.encaisses,
            other.rejetes,
            other.totalAmountCashed,
            other.rejectionRate,
            other.meanDelayHours,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        total,
        aTraiter,
        enTraitement,
        encaisses,
        rejetes,
        totalAmountCashed,
        rejectionRate,
        meanDelayHours,
    ],);

  factory BankAnalyticsTotalsDto.fromJson(Map<String, dynamic> json) => _$BankAnalyticsTotalsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankAnalyticsTotalsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

