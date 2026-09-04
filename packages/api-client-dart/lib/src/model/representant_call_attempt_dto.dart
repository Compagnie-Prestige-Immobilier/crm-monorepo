//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/rep_call_outcome.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_call_attempt_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantCallAttemptDto {
  /// Returns a new [RepresentantCallAttemptDto] instance.
  RepresentantCallAttemptDto({
    required this.id,

    required this.outcome,

    required this.statutQualificationId,

    required this.statutQualificationLabel,

    required this.comment,

    required this.callbackAt,

    required this.promisedProspects,

    required this.etablissementConfirme,

    required this.numeroConfirme,

    required this.contacte,

    required this.connaitUES,

    required this.syndicat,

    required this.suggestedName,

    required this.suggestedPhoneE164,

    required this.suggestedNote,

    required this.deviceCallType,

    required this.deviceCallDurationSeconds,

    required this.deviceCallAt,

    required this.performedById,

    required this.performedByName,

    required this.clientCreatedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(
    name: r'outcome',
    required: true,
    includeIfNull: false,
    unknownEnumValue: RepCallOutcome.unknownDefaultOpenApi,
  )
  final RepCallOutcome outcome;

  @JsonKey(name: r'statutQualificationId', required: true, includeIfNull: true)
  final String? statutQualificationId;

  @JsonKey(
    name: r'statutQualificationLabel',
    required: true,
    includeIfNull: true,
  )
  final String? statutQualificationLabel;

  @JsonKey(name: r'comment', required: true, includeIfNull: true)
  final String? comment;

  @JsonKey(name: r'callbackAt', required: true, includeIfNull: true)
  final DateTime? callbackAt;

  @JsonKey(name: r'promisedProspects', required: true, includeIfNull: true)
  final num? promisedProspects;

  @JsonKey(name: r'etablissementConfirme', required: true, includeIfNull: true)
  final bool? etablissementConfirme;

  @JsonKey(name: r'numeroConfirme', required: true, includeIfNull: true)
  final bool? numeroConfirme;

  @JsonKey(name: r'contacte', required: true, includeIfNull: true)
  final bool? contacte;

  @JsonKey(name: r'connaitUES', required: true, includeIfNull: true)
  final bool? connaitUES;

  @JsonKey(name: r'syndicat', required: true, includeIfNull: true)
  final String? syndicat;

  @JsonKey(name: r'suggestedName', required: true, includeIfNull: true)
  final String? suggestedName;

  @JsonKey(name: r'suggestedPhoneE164', required: true, includeIfNull: true)
  final String? suggestedPhoneE164;

  @JsonKey(name: r'suggestedNote', required: true, includeIfNull: true)
  final String? suggestedNote;

  @JsonKey(name: r'deviceCallType', required: true, includeIfNull: true)
  final String? deviceCallType;

  @JsonKey(
    name: r'deviceCallDurationSeconds',
    required: true,
    includeIfNull: true,
  )
  final num? deviceCallDurationSeconds;

  @JsonKey(name: r'deviceCallAt', required: true, includeIfNull: true)
  final DateTime? deviceCallAt;

  @JsonKey(name: r'performedById', required: true, includeIfNull: false)
  final String performedById;

  @JsonKey(name: r'performedByName', required: true, includeIfNull: false)
  final String performedByName;

  @JsonKey(name: r'clientCreatedAt', required: true, includeIfNull: false)
  final DateTime clientCreatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepresentantCallAttemptDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                outcome,
                statutQualificationId,
                statutQualificationLabel,
                comment,
                callbackAt,
                promisedProspects,
                etablissementConfirme,
                numeroConfirme,
                contacte,
                connaitUES,
                syndicat,
                suggestedName,
                suggestedPhoneE164,
                suggestedNote,
                deviceCallType,
                deviceCallDurationSeconds,
                deviceCallAt,
                performedById,
                performedByName,
                clientCreatedAt,
              ],
              [
                other.id,
                other.outcome,
                other.statutQualificationId,
                other.statutQualificationLabel,
                other.comment,
                other.callbackAt,
                other.promisedProspects,
                other.etablissementConfirme,
                other.numeroConfirme,
                other.contacte,
                other.connaitUES,
                other.syndicat,
                other.suggestedName,
                other.suggestedPhoneE164,
                other.suggestedNote,
                other.deviceCallType,
                other.deviceCallDurationSeconds,
                other.deviceCallAt,
                other.performedById,
                other.performedByName,
                other.clientCreatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        outcome,
        statutQualificationId,
        statutQualificationLabel,
        comment,
        callbackAt,
        promisedProspects,
        etablissementConfirme,
        numeroConfirme,
        contacte,
        connaitUES,
        syndicat,
        suggestedName,
        suggestedPhoneE164,
        suggestedNote,
        deviceCallType,
        deviceCallDurationSeconds,
        deviceCallAt,
        performedById,
        performedByName,
        clientCreatedAt,
      ]);

  factory RepresentantCallAttemptDto.fromJson(Map<String, dynamic> json) =>
      _$RepresentantCallAttemptDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantCallAttemptDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
