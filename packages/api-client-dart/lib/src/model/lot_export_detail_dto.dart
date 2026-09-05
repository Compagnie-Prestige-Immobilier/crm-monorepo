//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/lot_export_distribution_dto.dart';
import 'package:crm_api_client/src/model/lot_export_attempt_dto.dart';
import 'package:crm_api_client/src/model/lot_export_repartition_dto.dart';
import 'package:crm_api_client/src/model/lot_export_cible.dart';
import 'package:crm_api_client/src/model/lot_export_performance_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'lot_export_detail_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LotExportDetailDto {
  /// Returns a new [LotExportDetailDto] instance.
  LotExportDetailDto({

    required  this.id,

    required  this.name,

    required  this.cible,

    required  this.projet,

    required  this.scopeLabel,

    required  this.itemCount,

    required  this.createdById,

    required  this.createdByName,

    required  this.createdAt,

    required  this.callsSince,

    required  this.fichesAppelees,

    required  this.recentAttempts,

    required  this.callsByTeleconseiller,

    required  this.distribution,

    required  this.repartition,

    required  this.performance,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'cible',
    required: true,
    includeIfNull: false,
  unknownEnumValue: LotExportCible.unknownDefaultOpenApi,
  )


  final LotExportCible cible;



  @JsonKey(
    
    name: r'projet',
    required: true,
    includeIfNull: false,
  unknownEnumValue: Projet.unknownDefaultOpenApi,
  )


  final Projet projet;



  @JsonKey(
    
    name: r'scopeLabel',
    required: true,
    includeIfNull: false,
  )


  final String scopeLabel;



  @JsonKey(
    
    name: r'itemCount',
    required: true,
    includeIfNull: false,
  )


  final num itemCount;



  @JsonKey(
    
    name: r'createdById',
    required: true,
    includeIfNull: false,
  )


  final String createdById;



  @JsonKey(
    
    name: r'createdByName',
    required: true,
    includeIfNull: false,
  )


  final String createdByName;



  @JsonKey(
    
    name: r'createdAt',
    required: true,
    includeIfNull: false,
  )


  final String createdAt;



  @JsonKey(
    
    name: r'callsSince',
    required: true,
    includeIfNull: false,
  )


  final num callsSince;



  @JsonKey(
    
    name: r'fichesAppelees',
    required: true,
    includeIfNull: false,
  )


  final num fichesAppelees;



  @JsonKey(
    
    name: r'recentAttempts',
    required: true,
    includeIfNull: false,
  )


  final List<LotExportAttemptDto> recentAttempts;



  @JsonKey(
    
    name: r'callsByTeleconseiller',
    required: true,
    includeIfNull: false,
  )


  final Object callsByTeleconseiller;



  @JsonKey(
    
    name: r'distribution',
    required: true,
    includeIfNull: false,
  )


  final LotExportDistributionDto distribution;



  @JsonKey(
    
    name: r'repartition',
    required: true,
    includeIfNull: false,
  )


  final List<LotExportRepartitionDto> repartition;



  @JsonKey(
    
    name: r'performance',
    required: true,
    includeIfNull: false,
  )


  final List<LotExportPerformanceDto> performance;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is LotExportDetailDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            name,
            cible,
            projet,
            scopeLabel,
            itemCount,
            createdById,
            createdByName,
            createdAt,
            callsSince,
            fichesAppelees,
            recentAttempts,
            callsByTeleconseiller,
            distribution,
            repartition,
            performance,
        ],
        [
            other.id,
            other.name,
            other.cible,
            other.projet,
            other.scopeLabel,
            other.itemCount,
            other.createdById,
            other.createdByName,
            other.createdAt,
            other.callsSince,
            other.fichesAppelees,
            other.recentAttempts,
            other.callsByTeleconseiller,
            other.distribution,
            other.repartition,
            other.performance,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        name,
        cible,
        projet,
        scopeLabel,
        itemCount,
        createdById,
        createdByName,
        createdAt,
        callsSince,
        fichesAppelees,
        recentAttempts,
        callsByTeleconseiller,
        distribution,
        repartition,
        performance,
    ],);

  factory LotExportDetailDto.fromJson(Map<String, dynamic> json) => _$LotExportDetailDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LotExportDetailDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

