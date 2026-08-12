//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/call_outcome.dart';
import 'package:crm_api_client/src/model/enrollment_method.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'campaign_attempt_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CampaignAttemptDto {
  /// Returns a new [CampaignAttemptDto] instance.
  CampaignAttemptDto({
    required this.id,

    required this.prospectId,

    required this.shortCode,

    required this.phoneE164,

    required this.outcome,

    required this.method,

    required this.comment,

    required this.performedById,

    required this.performedByName,

    required this.assignedToId,

    required this.createdAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'prospectId', required: true, includeIfNull: false)
  final String prospectId;

  /// Code court à six caractères du prospect.
  @JsonKey(name: r'shortCode', required: true, includeIfNull: false)
  final String shortCode;

  @JsonKey(name: r'phoneE164', required: true, includeIfNull: false)
  final String phoneE164;

  @JsonKey(
    name: r'outcome',
    required: true,
    includeIfNull: false,
    unknownEnumValue: CallOutcome.unknownDefaultOpenApi,
  )
  final CallOutcome outcome;

  /// Renseignée si et seulement si l’issue vaut METHOD_OBTAINED.
  @JsonKey(
    name: r'method',
    required: true,
    includeIfNull: true,
    unknownEnumValue: EnrollmentMethod.unknownDefaultOpenApi,
  )
  final EnrollmentMethod? method;

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
        other is CampaignAttemptDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                prospectId,
                shortCode,
                phoneE164,
                outcome,
                method,
                comment,
                performedById,
                performedByName,
                assignedToId,
                createdAt,
              ],
              [
                other.id,
                other.prospectId,
                other.shortCode,
                other.phoneE164,
                other.outcome,
                other.method,
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
        prospectId,
        shortCode,
        phoneE164,
        outcome,
        method,
        comment,
        performedById,
        performedByName,
        assignedToId,
        createdAt,
      ]);

  factory CampaignAttemptDto.fromJson(Map<String, dynamic> json) =>
      _$CampaignAttemptDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CampaignAttemptDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
