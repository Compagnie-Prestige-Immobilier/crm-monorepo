//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/call_outcome_effect.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'call_outcome_reason_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CallOutcomeReasonDto {
  /// Returns a new [CallOutcomeReasonDto] instance.
  CallOutcomeReasonDto({
    required this.id,

    required this.code,

    required this.label,

    required this.effect,

    required this.requiresComment,

    required this.requiresCallback,

    required this.countsAsReached,

    required this.isActive,

    required this.isSystem,

    required this.sortOrder,

    required this.color,

    required this.minPayloadVersion,

    required this.updatedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  /// Code stable, jamais modifiable : les tentatives déjà remontées le référencent.
  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(
    name: r'effect',
    required: true,
    includeIfNull: false,
    unknownEnumValue: CallOutcomeEffect.unknownDefaultOpenApi,
  )
  final CallOutcomeEffect effect;

  @JsonKey(name: r'requiresComment', required: true, includeIfNull: false)
  final bool requiresComment;

  @JsonKey(name: r'requiresCallback', required: true, includeIfNull: false)
  final bool requiresCallback;

  /// Compte pour un appel joignable dans le taux de joignabilité.
  @JsonKey(name: r'countsAsReached', required: true, includeIfNull: false)
  final bool countsAsReached;

  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  /// Motif système : porte une règle compilée, ni désactivable ni reconfigurable.
  @JsonKey(name: r'isSystem', required: true, includeIfNull: false)
  final bool isSystem;

  @JsonKey(name: r'sortOrder', required: true, includeIfNull: false)
  final num sortOrder;

  @JsonKey(name: r'color', required: true, includeIfNull: true)
  final String? color;

  /// Version de charge utile minimale du client. Un téléphone plus ancien ne reçoit pas ce motif : il ne saurait pas l’émettre.
  @JsonKey(name: r'minPayloadVersion', required: true, includeIfNull: false)
  final num minPayloadVersion;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CallOutcomeReasonDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                code,
                label,
                effect,
                requiresComment,
                requiresCallback,
                countsAsReached,
                isActive,
                isSystem,
                sortOrder,
                color,
                minPayloadVersion,
                updatedAt,
              ],
              [
                other.id,
                other.code,
                other.label,
                other.effect,
                other.requiresComment,
                other.requiresCallback,
                other.countsAsReached,
                other.isActive,
                other.isSystem,
                other.sortOrder,
                other.color,
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
        requiresComment,
        requiresCallback,
        countsAsReached,
        isActive,
        isSystem,
        sortOrder,
        color,
        minPayloadVersion,
        updatedAt,
      ]);

  factory CallOutcomeReasonDto.fromJson(Map<String, dynamic> json) =>
      _$CallOutcomeReasonDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CallOutcomeReasonDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
