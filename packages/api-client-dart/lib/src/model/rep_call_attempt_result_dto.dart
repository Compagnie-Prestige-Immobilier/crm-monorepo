//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/representant_lookup_dto.dart';
import 'package:crm_api_client/src/model/rep_call_attempt_apply_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'rep_call_attempt_result_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepCallAttemptResultDto {
  /// Returns a new [RepCallAttemptResultDto] instance.
  RepCallAttemptResultDto({
    required this.status,

    required this.attemptId,

    required this.suggestion,
  });

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: RepCallAttemptApplyStatus.unknownDefaultOpenApi,
  )
  final RepCallAttemptApplyStatus status;

  @JsonKey(name: r'attemptId', required: true, includeIfNull: false)
  final String attemptId;

  /// Ce que le numéro suggéré donne dans l’annuaire, dans la forme que la bannière de doublon du mobile sait déjà afficher. Nul si la tentative n’en portait pas.
  @JsonKey(name: r'suggestion', required: true, includeIfNull: true)
  final RepresentantLookupDto? suggestion;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepCallAttemptResultDto &&
            runtimeType == other.runtimeType &&
            equals(
              [status, attemptId, suggestion],
              [other.status, other.attemptId, other.suggestion],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([status, attemptId, suggestion]);

  factory RepCallAttemptResultDto.fromJson(Map<String, dynamic> json) =>
      _$RepCallAttemptResultDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepCallAttemptResultDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
