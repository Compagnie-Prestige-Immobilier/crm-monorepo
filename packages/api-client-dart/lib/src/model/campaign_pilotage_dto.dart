//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/campaign_closed_day_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'campaign_pilotage_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CampaignPilotageDto {
  /// Returns a new [CampaignPilotageDto] instance.
  CampaignPilotageDto({
    required this.campaignId,

    required this.tasks,

    required this.tasksContacted,

    required this.contactRate,

    required this.attempts,

    required this.reachableAttempts,

    required this.reachRate,

    required this.methodsObtained,

    required this.attemptsPerMethodObtained,

    required this.closedPerDay,

    required this.remaining,

    required this.observedPace,

    required this.estimatedEndDate,
  });

  /// Campagne observée. Nul quand aucune n’est précisée : le calcul porte alors sur l’ensemble des campagnes ACTIVES.
  @JsonKey(name: r'campaignId', required: true, includeIfNull: true)
  final String? campaignId;

  /// Tâches de la campagne, toutes issues confondues.
  @JsonKey(name: r'tasks', required: true, includeIfNull: false)
  final num tasks;

  /// Tâches ayant reçu au moins une tentative.
  @JsonKey(name: r'tasksContacted', required: true, includeIfNull: false)
  final num tasksContacted;

  /// Part des tâches touchées au moins une fois, en pourcentage. Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.
  @JsonKey(name: r'contactRate', required: true, includeIfNull: true)
  final num? contactRate;

  /// Tentatives d’appel rattachées à la campagne.
  @JsonKey(name: r'attempts', required: true, includeIfNull: false)
  final num attempts;

  /// Tentatives dont l’issue n’est ni « injoignable » ni « faux numéro ».
  @JsonKey(name: r'reachableAttempts', required: true, includeIfNull: false)
  final num reachableAttempts;

  /// Part des tentatives joignables, en pourcentage. Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.
  @JsonKey(name: r'reachRate', required: true, includeIfNull: true)
  final num? reachRate;

  /// Tentatives ayant abouti à une méthode obtenue.
  @JsonKey(name: r'methodsObtained', required: true, includeIfNull: false)
  final num methodsObtained;

  /// Nombre moyen de tentatives pour une méthode obtenue. Vaut 0 tant qu’aucune méthode n’a été obtenue, faute de dénominateur.
  @JsonKey(
    name: r'attemptsPerMethodObtained',
    required: true,
    includeIfNull: false,
  )
  final num attemptsPerMethodObtained;

  /// Tâches clôturées, par jour et par commercial.
  @JsonKey(name: r'closedPerDay', required: true, includeIfNull: false)
  final List<CampaignClosedDayDto> closedPerDay;

  /// Tâches encore ouvertes.
  @JsonKey(name: r'remaining', required: true, includeIfNull: false)
  final num remaining;

  /// Cadence observée : tâches clôturées par jour sur les 7 derniers jours.
  @JsonKey(name: r'observedPace', required: true, includeIfNull: false)
  final num observedPace;

  /// Date de fin projetée à la cadence observée. Nulle quand la cadence est nulle : une campagne à l’arrêt n’a pas de date de fin, et en annoncer une serait une division par zéro déguisée en prévision.
  @JsonKey(name: r'estimatedEndDate', required: true, includeIfNull: true)
  final DateTime? estimatedEndDate;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CampaignPilotageDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                campaignId,
                tasks,
                tasksContacted,
                contactRate,
                attempts,
                reachableAttempts,
                reachRate,
                methodsObtained,
                attemptsPerMethodObtained,
                closedPerDay,
                remaining,
                observedPace,
                estimatedEndDate,
              ],
              [
                other.campaignId,
                other.tasks,
                other.tasksContacted,
                other.contactRate,
                other.attempts,
                other.reachableAttempts,
                other.reachRate,
                other.methodsObtained,
                other.attemptsPerMethodObtained,
                other.closedPerDay,
                other.remaining,
                other.observedPace,
                other.estimatedEndDate,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        campaignId,
        tasks,
        tasksContacted,
        contactRate,
        attempts,
        reachableAttempts,
        reachRate,
        methodsObtained,
        attemptsPerMethodObtained,
        closedPerDay,
        remaining,
        observedPace,
        estimatedEndDate,
      ]);

  factory CampaignPilotageDto.fromJson(Map<String, dynamic> json) =>
      _$CampaignPilotageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CampaignPilotageDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
