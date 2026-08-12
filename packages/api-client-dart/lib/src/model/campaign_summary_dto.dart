//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/campaign_status.dart';
import 'package:crm_api_client/src/model/campaign_progress_dto.dart';
import 'package:crm_api_client/src/model/campaign_scope.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'campaign_summary_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CampaignSummaryDto {
  /// Returns a new [CampaignSummaryDto] instance.
  CampaignSummaryDto({
    required this.id,

    required this.name,

    required this.scope,

    required this.scopeLabel,

    required this.status,

    required this.seed,

    required this.createdById,

    required this.createdByName,

    required this.commercialCount,

    required this.progress,

    required this.createdAt,

    required this.closedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(
    name: r'scope',
    required: true,
    includeIfNull: false,
    unknownEnumValue: CampaignScope.unknownDefaultOpenApi,
  )
  final CampaignScope scope;

  /// Libellé lisible du périmètre, issu de la définition partagée.
  @JsonKey(name: r'scopeLabel', required: true, includeIfNull: false)
  final String scopeLabel;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: CampaignStatus.unknownDefaultOpenApi,
  )
  final CampaignStatus status;

  /// Graine du tirage, persistée pour pouvoir rejouer et auditer la répartition. Les affectations, elles, sont matérialisées.
  @JsonKey(name: r'seed', required: true, includeIfNull: false)
  final String seed;

  @JsonKey(name: r'createdById', required: true, includeIfNull: false)
  final String createdById;

  @JsonKey(name: r'createdByName', required: true, includeIfNull: false)
  final String createdByName;

  @JsonKey(name: r'commercialCount', required: true, includeIfNull: false)
  final num commercialCount;

  @JsonKey(name: r'progress', required: true, includeIfNull: false)
  final CampaignProgressDto progress;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  @JsonKey(name: r'closedAt', required: true, includeIfNull: true)
  final DateTime? closedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CampaignSummaryDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                name,
                scope,
                scopeLabel,
                status,
                seed,
                createdById,
                createdByName,
                commercialCount,
                progress,
                createdAt,
                closedAt,
              ],
              [
                other.id,
                other.name,
                other.scope,
                other.scopeLabel,
                other.status,
                other.seed,
                other.createdById,
                other.createdByName,
                other.commercialCount,
                other.progress,
                other.createdAt,
                other.closedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        name,
        scope,
        scopeLabel,
        status,
        seed,
        createdById,
        createdByName,
        commercialCount,
        progress,
        createdAt,
        closedAt,
      ]);

  factory CampaignSummaryDto.fromJson(Map<String, dynamic> json) =>
      _$CampaignSummaryDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CampaignSummaryDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
