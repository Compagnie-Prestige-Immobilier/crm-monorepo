//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/bank_bank_breakdown_dto.dart';
import 'package:crm_api_client/src/model/bank_stage_count_dto.dart';
import 'package:crm_api_client/src/model/bank_agent_activity_dto.dart';
import 'package:crm_api_client/src/model/bank_analytics_totals_dto.dart';
import 'package:crm_api_client/src/model/bank_rejection_breakdown_dto.dart';
import 'package:crm_api_client/src/model/bank_time_bucket_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_case_analytics_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankCaseAnalyticsDto {
  /// Returns a new [BankCaseAnalyticsDto] instance.
  BankCaseAnalyticsDto({

    required  this.totals,

    required  this.byStage,

    required  this.createdOverTime,

    required  this.cashingsOverTime,

    required  this.byBank,

    required  this.byRejectionReason,

    required  this.byAgent,
  });

  @JsonKey(
    
    name: r'totals',
    required: true,
    includeIfNull: false,
  )


  final BankAnalyticsTotalsDto totals;



  @JsonKey(
    
    name: r'byStage',
    required: true,
    includeIfNull: false,
  )


  final List<BankStageCountDto> byStage;



      /// Dossiers créés dans le temps.
  @JsonKey(
    
    name: r'createdOverTime',
    required: true,
    includeIfNull: false,
  )


  final List<BankTimeBucketDto> createdOverTime;



      /// Encaissements dans le temps, en nombre et en montant.
  @JsonKey(
    
    name: r'cashingsOverTime',
    required: true,
    includeIfNull: false,
  )


  final List<BankTimeBucketDto> cashingsOverTime;



  @JsonKey(
    
    name: r'byBank',
    required: true,
    includeIfNull: false,
  )


  final List<BankBankBreakdownDto> byBank;



  @JsonKey(
    
    name: r'byRejectionReason',
    required: true,
    includeIfNull: false,
  )


  final List<BankRejectionBreakdownDto> byRejectionReason;



  @JsonKey(
    
    name: r'byAgent',
    required: true,
    includeIfNull: false,
  )


  final List<BankAgentActivityDto> byAgent;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is BankCaseAnalyticsDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            totals,
            byStage,
            createdOverTime,
            cashingsOverTime,
            byBank,
            byRejectionReason,
            byAgent,
        ],
        [
            other.totals,
            other.byStage,
            other.createdOverTime,
            other.cashingsOverTime,
            other.byBank,
            other.byRejectionReason,
            other.byAgent,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        totals,
        byStage,
        createdOverTime,
        cashingsOverTime,
        byBank,
        byRejectionReason,
        byAgent,
    ],);

  factory BankCaseAnalyticsDto.fromJson(Map<String, dynamic> json) => _$BankCaseAnalyticsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankCaseAnalyticsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

