//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/rep_campaign_commercial_dto.dart';
import 'package:crm_api_client/src/model/rep_campaign_progress_dto.dart';
import 'package:crm_api_client/src/model/campaign_status.dart';
import 'package:crm_api_client/src/model/rep_campaign_attempt_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'rep_campaign_detail_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepCampaignDetailDto {
  /// Returns a new [RepCampaignDetailDto] instance.
  RepCampaignDetailDto({
    required this.id,

    required this.name,

    required this.status,

    required this.seed,

    required this.scopeLabel,

    required this.departementId,

    required this.iefId,

    required this.onlyWithoutProspects,

    required this.createdById,

    required this.createdByName,

    required this.commercialCount,

    required this.spreadDays,

    required this.progress,

    required this.createdAt,

    required this.closedAt,

    required this.perDay,

    required this.commerciaux,

    required this.recentAttempts,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

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

  /// Libellé lisible du périmètre, composé côté serveur.
  @JsonKey(name: r'scopeLabel', required: true, includeIfNull: false)
  final String scopeLabel;

  @JsonKey(name: r'departementId', required: true, includeIfNull: true)
  final String? departementId;

  @JsonKey(name: r'iefId', required: true, includeIfNull: true)
  final String? iefId;

  @JsonKey(name: r'onlyWithoutProspects', required: true, includeIfNull: false)
  final bool onlyWithoutProspects;

  @JsonKey(name: r'createdById', required: true, includeIfNull: false)
  final String createdById;

  @JsonKey(name: r'createdByName', required: true, includeIfNull: false)
  final String createdByName;

  @JsonKey(name: r'commercialCount', required: true, includeIfNull: false)
  final num commercialCount;

  /// Journées d’étalement. 1 : programme unique.
  @JsonKey(name: r'spreadDays', required: true, includeIfNull: false)
  final num spreadDays;

  @JsonKey(name: r'progress', required: true, includeIfNull: false)
  final RepCampaignProgressDto progress;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  @JsonKey(name: r'closedAt', required: true, includeIfNull: true)
  final DateTime? closedAt;

  /// Lignes par journée, toutes affectations confondues. Jour 1 en tête.
  @JsonKey(name: r'perDay', required: true, includeIfNull: false)
  final List<num> perDay;

  /// Ordonnés par position.
  @JsonKey(name: r'commerciaux', required: true, includeIfNull: false)
  final List<RepCampaignCommercialDto> commerciaux;

  /// Les vingt dernières tentatives, de la plus récente à la plus ancienne.
  @JsonKey(name: r'recentAttempts', required: true, includeIfNull: false)
  final List<RepCampaignAttemptDto> recentAttempts;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepCampaignDetailDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                name,
                status,
                seed,
                scopeLabel,
                departementId,
                iefId,
                onlyWithoutProspects,
                createdById,
                createdByName,
                commercialCount,
                spreadDays,
                progress,
                createdAt,
                closedAt,
                perDay,
                commerciaux,
                recentAttempts,
              ],
              [
                other.id,
                other.name,
                other.status,
                other.seed,
                other.scopeLabel,
                other.departementId,
                other.iefId,
                other.onlyWithoutProspects,
                other.createdById,
                other.createdByName,
                other.commercialCount,
                other.spreadDays,
                other.progress,
                other.createdAt,
                other.closedAt,
                other.perDay,
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
        status,
        seed,
        scopeLabel,
        departementId,
        iefId,
        onlyWithoutProspects,
        createdById,
        createdByName,
        commercialCount,
        spreadDays,
        progress,
        createdAt,
        closedAt,
        perDay,
        commerciaux,
        recentAttempts,
      ]);

  factory RepCampaignDetailDto.fromJson(Map<String, dynamic> json) =>
      _$RepCampaignDetailDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepCampaignDetailDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
