//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/funnel_stage_dto.dart';
import 'package:crm_api_client/src/model/analytics_finance_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'analytics_funnel_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AnalyticsFunnelDto {
  /// Returns a new [AnalyticsFunnelDto] instance.
  AnalyticsFunnelDto({

    required  this.etapes,

    required  this.finance,
  });

      /// Les quatre étapes, du prospect saisi au dossier encaissé.
  @JsonKey(
    
    name: r'etapes',
    required: true,
    includeIfNull: false,
  )


  final List<FunnelStageDto> etapes;



  @JsonKey(
    
    name: r'finance',
    required: true,
    includeIfNull: false,
  )


  final AnalyticsFinanceDto finance;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is AnalyticsFunnelDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            etapes,
            finance,
        ],
        [
            other.etapes,
            other.finance,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        etapes,
        finance,
    ],);

  factory AnalyticsFunnelDto.fromJson(Map<String, dynamic> json) => _$AnalyticsFunnelDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AnalyticsFunnelDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

