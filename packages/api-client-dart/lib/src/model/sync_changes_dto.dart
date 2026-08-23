//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/departement_dto.dart';
import 'package:crm_api_client/src/model/representant_dto.dart';
import 'package:crm_api_client/src/model/prospect_dto.dart';
import 'package:crm_api_client/src/model/ief_dto.dart';
import 'package:crm_api_client/src/model/sync_visite_referentiel_dto.dart';
import 'package:crm_api_client/src/model/sync_call_task_dto.dart';
import 'package:crm_api_client/src/model/canal_provenance_dto.dart';
import 'package:crm_api_client/src/model/sync_visite_dto.dart';
import 'package:crm_api_client/src/model/syndicat_dto.dart';
import 'package:crm_api_client/src/model/banque_dto.dart';
import 'package:crm_api_client/src/model/sync_call_campaign_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_changes_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncChangesDto {
  /// Returns a new [SyncChangesDto] instance.
  SyncChangesDto({
    required this.departements,

    required this.iefs,

    required this.banques,

    required this.syndicats,

    required this.canauxProvenance,

    required this.visiteReferentiels,

    required this.representants,

    required this.prospects,

    required this.callCampaigns,

    required this.callTasks,

    required this.visites,
  });

  @JsonKey(name: r'departements', required: true, includeIfNull: false)
  final List<DepartementDto> departements;

  @JsonKey(name: r'iefs', required: true, includeIfNull: false)
  final List<IefDto> iefs;

  @JsonKey(name: r'banques', required: true, includeIfNull: false)
  final List<BanqueDto> banques;

  @JsonKey(name: r'syndicats', required: true, includeIfNull: false)
  final List<SyndicatDto> syndicats;

  @JsonKey(name: r'canauxProvenance', required: true, includeIfNull: false)
  final List<CanalProvenanceDto> canauxProvenance;

  /// Les quatre listes du registre des visites, réunies : chaque entrée porte sa nature.
  @JsonKey(name: r'visiteReferentiels', required: true, includeIfNull: false)
  final List<SyncVisiteReferentielDto> visiteReferentiels;

  @JsonKey(name: r'representants', required: true, includeIfNull: false)
  final List<RepresentantDto> representants;

  @JsonKey(name: r'prospects', required: true, includeIfNull: false)
  final List<ProspectDto> prospects;

  @JsonKey(name: r'callCampaigns', required: true, includeIfNull: false)
  final List<SyncCallCampaignDto> callCampaigns;

  @JsonKey(name: r'callTasks', required: true, includeIfNull: false)
  final List<SyncCallTaskDto> callTasks;

  @JsonKey(name: r'visites', required: true, includeIfNull: false)
  final List<SyncVisiteDto> visites;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SyncChangesDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                departements,
                iefs,
                banques,
                syndicats,
                canauxProvenance,
                visiteReferentiels,
                representants,
                prospects,
                callCampaigns,
                callTasks,
                visites,
              ],
              [
                other.departements,
                other.iefs,
                other.banques,
                other.syndicats,
                other.canauxProvenance,
                other.visiteReferentiels,
                other.representants,
                other.prospects,
                other.callCampaigns,
                other.callTasks,
                other.visites,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        departements,
        iefs,
        banques,
        syndicats,
        canauxProvenance,
        visiteReferentiels,
        representants,
        prospects,
        callCampaigns,
        callTasks,
        visites,
      ]);

  factory SyncChangesDto.fromJson(Map<String, dynamic> json) =>
      _$SyncChangesDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncChangesDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
