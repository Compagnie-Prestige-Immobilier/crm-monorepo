//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/priorite_traitement.dart';
import 'package:crm_api_client/src/model/statut_qualification_effect.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_statut_qualification_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateStatutQualificationDto {
  /// Returns a new [CreateStatutQualificationDto] instance.
  CreateStatutQualificationDto({
    required this.code,

    required this.label,

    required this.effect,

    this.requiresCallback = false,

    this.priorite = PrioriteTraitement.NORMALE,
  });

  /// Immuable : l’historique le référence.
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

  @JsonKey(
    defaultValue: false,
    name: r'requiresCallback',
    required: false,
    includeIfNull: false,
  )
  final bool? requiresCallback;

  @JsonKey(
    defaultValue: PrioriteTraitement.NORMALE,
    name: r'priorite',
    required: false,
    includeIfNull: false,
    unknownEnumValue: PrioriteTraitement.unknownDefaultOpenApi,
  )
  final PrioriteTraitement? priorite;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateStatutQualificationDto &&
            runtimeType == other.runtimeType &&
            equals(
              [code, label, effect, requiresCallback, priorite],
              [
                other.code,
                other.label,
                other.effect,
                other.requiresCallback,
                other.priorite,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([code, label, effect, requiresCallback, priorite]);

  factory CreateStatutQualificationDto.fromJson(Map<String, dynamic> json) =>
      _$CreateStatutQualificationDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateStatutQualificationDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
