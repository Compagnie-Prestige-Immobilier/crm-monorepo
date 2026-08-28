//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/representant_relation.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_rep_campaign_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateRepCampaignDto {
  /// Returns a new [CreateRepCampaignDto] instance.
  CreateRepCampaignDto({
    required this.name,

    required this.commercialIds,

    this.departementId,

    this.iefId,

    this.onlyWithoutProspects = false,

    this.relationStatuses,

    this.spreadDays = 1,
  });

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  /// Commerciaux destinataires, DANS L’ORDRE du tourniquet. Cet ordre est persisté en `position` et fige le contenu de chaque programme.
  @JsonKey(name: r'commercialIds', required: true, includeIfNull: false)
  final List<String> commercialIds;

  /// Restreint le tirage à un département. Cumulable avec `iefId`.
  @JsonKey(name: r'departementId', required: false, includeIfNull: false)
  final String? departementId;

  /// Restreint le tirage à une IEF.
  @JsonKey(name: r'iefId', required: false, includeIfNull: false)
  final String? iefId;

  /// Ne retenir que les représentants n’ayant apporté aucun prospect vivant. C’est la campagne de relance des dormants.
  @JsonKey(
    defaultValue: false,
    name: r'onlyWithoutProspects',
    required: false,
    includeIfNull: false,
  )
  final bool? onlyWithoutProspects;

  /// Ne retenir que les représentants dans ces états de relation. Absente ou vide : aucun filtre. `AMBASSADEUR` seul donne les qualifiés ; une liste qui l’exclut donne les non qualifiés.
  @JsonKey(name: r'relationStatuses', required: false, includeIfNull: false)
  final List<RepresentantRelation>? relationStatuses;

  /// Étale la file de chaque commercial sur N journées. À 1 (défaut), un seul programme par commercial.
  // minimum: 1
  // maximum: 31
  @JsonKey(
    defaultValue: 1,
    name: r'spreadDays',
    required: false,
    includeIfNull: false,
  )
  final num? spreadDays;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateRepCampaignDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                name,
                commercialIds,
                departementId,
                iefId,
                onlyWithoutProspects,
                relationStatuses,
                spreadDays,
              ],
              [
                other.name,
                other.commercialIds,
                other.departementId,
                other.iefId,
                other.onlyWithoutProspects,
                other.relationStatuses,
                other.spreadDays,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        name,
        commercialIds,
        departementId,
        iefId,
        onlyWithoutProspects,
        relationStatuses,
        spreadDays,
      ]);

  factory CreateRepCampaignDto.fromJson(Map<String, dynamic> json) =>
      _$CreateRepCampaignDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateRepCampaignDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
