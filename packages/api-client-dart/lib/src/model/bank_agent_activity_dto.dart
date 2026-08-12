//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_agent_activity_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankAgentActivityDto {
  /// Returns a new [BankAgentActivityDto] instance.
  BankAgentActivityDto({
    required this.agentId,

    required this.label,

    required this.created,

    required this.transitions,

    required this.cashed,

    required this.amountXof,
  });

  @JsonKey(name: r'agentId', required: true, includeIfNull: false)
  final String agentId;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  /// Dossiers créés par l’agent.
  @JsonKey(name: r'created', required: true, includeIfNull: false)
  final num created;

  /// Transitions écrites par l’agent.
  @JsonKey(name: r'transitions', required: true, includeIfNull: false)
  final num transitions;

  /// Dossiers menés à l’encaissement par l’agent.
  @JsonKey(name: r'cashed', required: true, includeIfNull: false)
  final num cashed;

  /// Montant encaissé par l’agent, en chaîne.
  @JsonKey(name: r'amountXof', required: true, includeIfNull: false)
  final String amountXof;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is BankAgentActivityDto &&
            runtimeType == other.runtimeType &&
            equals(
              [agentId, label, created, transitions, cashed, amountXof],
              [
                other.agentId,
                other.label,
                other.created,
                other.transitions,
                other.cashed,
                other.amountXof,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        agentId,
        label,
        created,
        transitions,
        cashed,
        amountXof,
      ]);

  factory BankAgentActivityDto.fromJson(Map<String, dynamic> json) =>
      _$BankAgentActivityDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankAgentActivityDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
