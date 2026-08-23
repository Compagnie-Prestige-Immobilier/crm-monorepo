//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/campaign_scope.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_campaign_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateCampaignDto {
  /// Returns a new [CreateCampaignDto] instance.
  CreateCampaignDto({
    required this.name,

    this.projet = Projet.CHUES,

    required this.scope,

    this.offerId,

    this.canalProvenanceId,

    this.professionId,

    this.incomeBandId,

    required this.commercialIds,

    this.spreadDays = 1,
  });

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(
    defaultValue: Projet.CHUES,
    name: r'projet',
    required: false,
    includeIfNull: false,
    unknownEnumValue: Projet.unknownDefaultOpenApi,
  )
  final Projet? projet;

  /// Périmètre du tirage. BDD1..BDD4 sont les segments partagés ; ALL réunit les quatre sans recouvrement.
  @JsonKey(
    name: r'scope',
    required: true,
    includeIfNull: false,
    unknownEnumValue: CampaignScope.unknownDefaultOpenApi,
  )
  final CampaignScope scope;

  /// Offre ciblée, pour Grand Public.
  @JsonKey(name: r'offerId', required: false, includeIfNull: false)
  final String? offerId;

  @JsonKey(name: r'canalProvenanceId', required: false, includeIfNull: false)
  final String? canalProvenanceId;

  @JsonKey(name: r'professionId', required: false, includeIfNull: false)
  final String? professionId;

  @JsonKey(name: r'incomeBandId', required: false, includeIfNull: false)
  final String? incomeBandId;

  /// Commerciaux destinataires, DANS L’ORDRE du tourniquet. Cet ordre est persisté en `position` et fige le contenu de chaque programme.
  @JsonKey(name: r'commercialIds', required: true, includeIfNull: false)
  final List<String> commercialIds;

  /// Étale la file de chaque commercial sur N journées. À 1 (défaut), comportement inchangé : un seul programme. Au-delà, chaque commercial reçoit un programme par jour, ce qui rend une base de 120 000 fiches distribuable.
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
        other is CreateCampaignDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                name,
                projet,
                scope,
                offerId,
                canalProvenanceId,
                professionId,
                incomeBandId,
                commercialIds,
                spreadDays,
              ],
              [
                other.name,
                other.projet,
                other.scope,
                other.offerId,
                other.canalProvenanceId,
                other.professionId,
                other.incomeBandId,
                other.commercialIds,
                other.spreadDays,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        name,
        projet,
        scope,
        offerId,
        canalProvenanceId,
        professionId,
        incomeBandId,
        commercialIds,
        spreadDays,
      ]);

  factory CreateCampaignDto.fromJson(Map<String, dynamic> json) =>
      _$CreateCampaignDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateCampaignDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
