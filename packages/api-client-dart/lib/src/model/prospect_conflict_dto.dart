//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/prospect_conflict_existing_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'prospect_conflict_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProspectConflictDto {
  /// Returns a new [ProspectConflictDto] instance.
  ProspectConflictDto({
    required this.code,

    required this.message,

    required this.existing,
  });

  @JsonKey(
    name: r'code',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ProspectConflictDtoCodeEnum.unknownDefaultOpenApi,
  )
  final ProspectConflictDtoCodeEnum code;

  @JsonKey(name: r'message', required: true, includeIfNull: false)
  final String message;

  @JsonKey(name: r'existing', required: true, includeIfNull: false)
  final ProspectConflictExistingDto existing;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ProspectConflictDto &&
            runtimeType == other.runtimeType &&
            equals(
              [code, message, existing],
              [other.code, other.message, other.existing],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([code, message, existing]);

  factory ProspectConflictDto.fromJson(Map<String, dynamic> json) =>
      _$ProspectConflictDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ProspectConflictDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ProspectConflictDtoCodeEnum {
  @JsonValue(r'PROSPECT_PHONE_CONFLICT')
  PROSPECT_PHONE_CONFLICT(r'PROSPECT_PHONE_CONFLICT'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const ProspectConflictDtoCodeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
