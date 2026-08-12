//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/campaign_attempt_dto.dart';
import 'package:crm_api_client/src/model/campaign_status.dart';
import 'package:crm_api_client/src/model/campaign_progress_dto.dart';
import 'package:crm_api_client/src/model/campaign_scope.dart';
import 'package:crm_api_client/src/model/campaign_commercial_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'campaign_detail_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CampaignDetailDto {
  /// Returns a new [CampaignDetailDto] instance.
  CampaignDetailDto({
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

    required this.commerciaux,

    required this.recentAttempts,
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

  @JsonKey(name: r'scopeLabel', required: true, includeIfNull: false)
  final String scopeLabel;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: CampaignStatus.unknownDefaultOpenApi,
  )
  final CampaignStatus status;

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

  /// Ordonnés par position.
  @JsonKey(name: r'commerciaux', required: true, includeIfNull: false)
  final List<CampaignCommercialDto> commerciaux;

  /// Les vingt dernières tentatives, de la plus récente à la plus ancienne.
  @JsonKey(name: r'recentAttempts', required: true, includeIfNull: false)
  final List<CampaignAttemptDto> recentAttempts;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CampaignDetailDto &&
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
                commerciaux,
                recentAttempts,
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
                other.commerciaux,
                other.recentAttempts,
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
        commerciaux,
        recentAttempts,
      ]);

  factory CampaignDetailDto.fromJson(Map<String, dynamic> json) =>
      _$CampaignDetailDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CampaignDetailDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
