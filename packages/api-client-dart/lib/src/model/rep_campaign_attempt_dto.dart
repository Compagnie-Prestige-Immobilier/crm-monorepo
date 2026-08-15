//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/rep_call_outcome.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'rep_campaign_attempt_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepCampaignAttemptDto {
  /// Returns a new [RepCampaignAttemptDto] instance.
  RepCampaignAttemptDto({
    required this.id,

    required this.representantId,

    required this.shortCode,

    required this.phoneE164,

    required this.outcome,

    required this.promisedProspects,

    required this.comment,

    required this.performedById,

    required this.performedByName,

    required this.assignedToId,

    required this.createdAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'representantId', required: true, includeIfNull: false)
  final String representantId;

  /// Code court à six caractères du représentant.
  @JsonKey(name: r'shortCode', required: true, includeIfNull: false)
  final String shortCode;

  @JsonKey(name: r'phoneE164', required: true, includeIfNull: false)
  final String phoneE164;

  @JsonKey(
    name: r'outcome',
    required: true,
    includeIfNull: false,
    unknownEnumValue: RepCallOutcome.unknownDefaultOpenApi,
  )
  final RepCallOutcome outcome;

  /// Renseigné si et seulement si l’issue vaut PROSPECTS_PROMISED.
  @JsonKey(name: r'promisedProspects', required: true, includeIfNull: true)
  final num? promisedProspects;

  @JsonKey(name: r'comment', required: true, includeIfNull: true)
  final String? comment;

  /// Commercial qui a RÉELLEMENT passé l’appel.
  @JsonKey(name: r'performedById', required: true, includeIfNull: false)
  final String performedById;

  @JsonKey(name: r'performedByName', required: true, includeIfNull: false)
  final String performedByName;

  /// Commercial à qui la tâche était affectée. Peut différer de performedById.
  @JsonKey(name: r'assignedToId', required: true, includeIfNull: true)
  final String? assignedToId;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepCampaignAttemptDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                representantId,
                shortCode,
                phoneE164,
                outcome,
                promisedProspects,
                comment,
                performedById,
                performedByName,
                assignedToId,
                createdAt,
              ],
              [
                other.id,
                other.representantId,
                other.shortCode,
                other.phoneE164,
                other.outcome,
                other.promisedProspects,
                other.comment,
                other.performedById,
                other.performedByName,
                other.assignedToId,
                other.createdAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        representantId,
        shortCode,
        phoneE164,
        outcome,
        promisedProspects,
        comment,
        performedById,
        performedByName,
        assignedToId,
        createdAt,
      ]);

  factory RepCampaignAttemptDto.fromJson(Map<String, dynamic> json) =>
      _$RepCampaignAttemptDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepCampaignAttemptDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
