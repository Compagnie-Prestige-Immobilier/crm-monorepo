//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/performance_score.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'supervision_score_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SupervisionScoreDto {
  /// Returns a new [SupervisionScoreDto] instance.
  SupervisionScoreDto({
    required this.teleconseillerId,

    required this.teleconseillerName,

    required this.activeSecondsInShifts,

    required this.shiftSecondsElapsed,

    required this.calls,

    required this.reached,

    required this.qualified,

    required this.repeatCalls,

    required this.deadSeconds,

    required this.score,
  });

  @JsonKey(name: r'teleconseillerId', required: true, includeIfNull: false)
  final String teleconseillerId;

  @JsonKey(name: r'teleconseillerName', required: true, includeIfNull: false)
  final String teleconseillerName;

  /// Présence relevée dans les créneaux, en secondes, sur toute la fenêtre.
  @JsonKey(name: r'activeSecondsInShifts', required: true, includeIfNull: false)
  final num activeSecondsInShifts;

  /// Secondes de créneau écoulées sur les seuls jours où le compte a été vu. La journée en cours ne compte que sa portion passée ; un filtre horaire restreint d’autant les créneaux.
  @JsonKey(name: r'shiftSecondsElapsed', required: true, includeIfNull: false)
  final num shiftSecondsElapsed;

  /// Tentatives, prospects et représentants confondus.
  @JsonKey(name: r'calls', required: true, includeIfNull: false)
  final num calls;

  /// Prospects dont le numéro s’est révélé exploitable, plus représentants ayant répondu.
  @JsonKey(name: r'reached', required: true, includeIfNull: false)
  final num reached;

  /// Méthodes obtenues, plus représentants dont la DERNIÈRE réponse de la fenêtre est REACHED.
  @JsonKey(name: r'qualified', required: true, includeIfNull: false)
  final num qualified;

  /// Appels au-delà du premier sur une même fiche.
  @JsonKey(name: r'repeatCalls', required: true, includeIfNull: false)
  final num repeatCalls;

  /// Écarts de plus de quinze minutes entre deux appels du même créneau et du même jour.
  @JsonKey(name: r'deadSeconds', required: true, includeIfNull: false)
  final num deadSeconds;

  @JsonKey(name: r'score', required: true, includeIfNull: false)
  final PerformanceScore score;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SupervisionScoreDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                teleconseillerId,
                teleconseillerName,
                activeSecondsInShifts,
                shiftSecondsElapsed,
                calls,
                reached,
                qualified,
                repeatCalls,
                deadSeconds,
                score,
              ],
              [
                other.teleconseillerId,
                other.teleconseillerName,
                other.activeSecondsInShifts,
                other.shiftSecondsElapsed,
                other.calls,
                other.reached,
                other.qualified,
                other.repeatCalls,
                other.deadSeconds,
                other.score,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        teleconseillerId,
        teleconseillerName,
        activeSecondsInShifts,
        shiftSecondsElapsed,
        calls,
        reached,
        qualified,
        repeatCalls,
        deadSeconds,
        score,
      ]);

  factory SupervisionScoreDto.fromJson(Map<String, dynamic> json) =>
      _$SupervisionScoreDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisionScoreDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
