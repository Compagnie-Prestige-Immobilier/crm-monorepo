//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/bank_stage_type.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_case_stage_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankCaseStageDto {
  /// Returns a new [BankCaseStageDto] instance.
  BankCaseStageDto({
    required this.id,

    required this.code,

    required this.label,

    required this.position,

    required this.color,

    required this.type,

    required this.isActive,

    required this.isInitial,

    required this.isSystem,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  /// Code stable, jamais modifiable après création.
  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'position', required: true, includeIfNull: false)
  final num position;

  /// Rôle du design system (info, warning, success…), pas un hex.
  @JsonKey(name: r'color', required: true, includeIfNull: false)
  final String color;

  @JsonKey(
    name: r'type',
    required: true,
    includeIfNull: false,
    unknownEnumValue: BankStageType.unknownDefaultOpenApi,
  )
  final BankStageType type;

  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  @JsonKey(name: r'isInitial', required: true, includeIfNull: false)
  final bool isInitial;

  /// Étape système : règles financières fixes, ni désactivable ni renommable en code.
  @JsonKey(name: r'isSystem', required: true, includeIfNull: false)
  final bool isSystem;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is BankCaseStageDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                code,
                label,
                position,
                color,
                type,
                isActive,
                isInitial,
                isSystem,
              ],
              [
                other.id,
                other.code,
                other.label,
                other.position,
                other.color,
                other.type,
                other.isActive,
                other.isInitial,
                other.isSystem,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        code,
        label,
        position,
        color,
        type,
        isActive,
        isInitial,
        isSystem,
      ]);

  factory BankCaseStageDto.fromJson(Map<String, dynamic> json) =>
      _$BankCaseStageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankCaseStageDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
