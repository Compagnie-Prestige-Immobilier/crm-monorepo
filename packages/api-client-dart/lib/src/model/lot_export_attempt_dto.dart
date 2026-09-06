//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'lot_export_attempt_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LotExportAttemptDto {
  /// Returns a new [LotExportAttemptDto] instance.
  LotExportAttemptDto({
    required this.id,

    required this.phoneE164,

    required this.shortCode,

    required this.outcome,

    required this.method,

    required this.comment,

    required this.performedByName,

    required this.createdAt,

    required this.email,

    required this.fonctionnaire,

    required this.engagementEnCours,

    required this.dureeEtablissementMois,

    required this.rendezVousAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'phoneE164', required: true, includeIfNull: false)
  final String phoneE164;

  @JsonKey(name: r'shortCode', required: true, includeIfNull: false)
  final String shortCode;

  @JsonKey(
    name: r'outcome',
    required: true,
    includeIfNull: false,
    unknownEnumValue: LotExportAttemptDtoOutcomeEnum.unknownDefaultOpenApi,
  )
  final LotExportAttemptDtoOutcomeEnum outcome;

  @JsonKey(
    name: r'method',
    required: true,
    includeIfNull: true,
    unknownEnumValue: LotExportAttemptDtoMethodEnum.unknownDefaultOpenApi,
  )
  final LotExportAttemptDtoMethodEnum? method;

  @JsonKey(name: r'comment', required: true, includeIfNull: true)
  final String? comment;

  @JsonKey(name: r'performedByName', required: true, includeIfNull: false)
  final String performedByName;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final String createdAt;

  @JsonKey(name: r'email', required: true, includeIfNull: true)
  final Object? email;

  @JsonKey(name: r'fonctionnaire', required: true, includeIfNull: true)
  final Object? fonctionnaire;

  @JsonKey(name: r'engagementEnCours', required: true, includeIfNull: true)
  final Object? engagementEnCours;

  @JsonKey(name: r'dureeEtablissementMois', required: true, includeIfNull: true)
  final Object? dureeEtablissementMois;

  @JsonKey(name: r'rendezVousAt', required: true, includeIfNull: true)
  final String? rendezVousAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is LotExportAttemptDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                phoneE164,
                shortCode,
                outcome,
                method,
                comment,
                performedByName,
                createdAt,
                email,
                fonctionnaire,
                engagementEnCours,
                dureeEtablissementMois,
                rendezVousAt,
              ],
              [
                other.id,
                other.phoneE164,
                other.shortCode,
                other.outcome,
                other.method,
                other.comment,
                other.performedByName,
                other.createdAt,
                other.email,
                other.fonctionnaire,
                other.engagementEnCours,
                other.dureeEtablissementMois,
                other.rendezVousAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        phoneE164,
        shortCode,
        outcome,
        method,
        comment,
        performedByName,
        createdAt,
        email,
        fonctionnaire,
        engagementEnCours,
        dureeEtablissementMois,
        rendezVousAt,
      ]);

  factory LotExportAttemptDto.fromJson(Map<String, dynamic> json) =>
      _$LotExportAttemptDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LotExportAttemptDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum LotExportAttemptDtoOutcomeEnum {
  @JsonValue(r'METHOD_OBTAINED')
  METHOD_OBTAINED(r'METHOD_OBTAINED'),
  @JsonValue(r'UNREACHABLE')
  UNREACHABLE(r'UNREACHABLE'),
  @JsonValue(r'CALLBACK')
  CALLBACK(r'CALLBACK'),
  @JsonValue(r'REFUSED')
  REFUSED(r'REFUSED'),
  @JsonValue(r'WRONG_NUMBER')
  WRONG_NUMBER(r'WRONG_NUMBER'),
  @JsonValue(r'OTHER')
  OTHER(r'OTHER'),
  @JsonValue(r'REACHED')
  REACHED(r'REACHED'),
  @JsonValue(r'PROSPECTS_PROMISED')
  PROSPECTS_PROMISED(r'PROSPECTS_PROMISED'),
  @JsonValue(r'UNREACHABLE')
  UNREACHABLE2(r'UNREACHABLE'),
  @JsonValue(r'CALLBACK')
  CALLBACK2(r'CALLBACK'),
  @JsonValue(r'REFUSED')
  REFUSED2(r'REFUSED'),
  @JsonValue(r'WRONG_NUMBER')
  WRONG_NUMBER2(r'WRONG_NUMBER'),
  @JsonValue(r'OTHER')
  OTHER2(r'OTHER'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const LotExportAttemptDtoOutcomeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum LotExportAttemptDtoMethodEnum {
  @JsonValue(r'PLATFORM')
  PLATFORM(r'PLATFORM'),
  @JsonValue(r'PHYSICAL')
  PHYSICAL(r'PHYSICAL'),
  @JsonValue(r'VOICE_OR_ELECTRONIC_MESSAGING')
  VOICE_OR_ELECTRONIC_MESSAGING(r'VOICE_OR_ELECTRONIC_MESSAGING'),
  @JsonValue(r'APPOINTMENT')
  APPOINTMENT(r'APPOINTMENT'),
  @JsonValue(r'WHATSAPP')
  WHATSAPP(r'WHATSAPP'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const LotExportAttemptDtoMethodEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
