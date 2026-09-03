//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/statut_qualification_effect.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'statut_qualification_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StatutQualificationDto {
  /// Returns a new [StatutQualificationDto] instance.
  StatutQualificationDto({
    required this.id,

    required this.code,

    required this.label,

    required this.effect,

    required this.requiresCallback,

    required this.isActive,

    required this.isSystem,

    required this.minPayloadVersion,

    required this.updatedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(
    name: r'effect',
    required: true,
    includeIfNull: false,
    unknownEnumValue: StatutQualificationEffect.unknownDefaultOpenApi,
  )
  final StatutQualificationEffect effect;

  /// La date du rappel est exigée par ce statut.
  @JsonKey(name: r'requiresCallback', required: true, includeIfNull: false)
  final bool requiresCallback;

  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  /// Le script s’appuie dessus : sa règle ne se reconfigure pas.
  @JsonKey(name: r'isSystem', required: true, includeIfNull: false)
  final bool isSystem;

  /// Version de charge utile minimale sachant émettre ce code.
  @JsonKey(name: r'minPayloadVersion', required: true, includeIfNull: false)
  final num minPayloadVersion;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is StatutQualificationDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                code,
                label,
                effect,
                requiresCallback,
                isActive,
                isSystem,
                minPayloadVersion,
                updatedAt,
              ],
              [
                other.id,
                other.code,
                other.label,
                other.effect,
                other.requiresCallback,
                other.isActive,
                other.isSystem,
                other.minPayloadVersion,
                other.updatedAt,
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
        effect,
        requiresCallback,
        isActive,
        isSystem,
        minPayloadVersion,
        updatedAt,
      ]);

  factory StatutQualificationDto.fromJson(Map<String, dynamic> json) =>
      _$StatutQualificationDtoFromJson(json);

  Map<String, dynamic> toJson() => _$StatutQualificationDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
