//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/departement_dto.dart';
import 'package:crm_api_client/src/model/representant_dto.dart';
import 'package:crm_api_client/src/model/prospect_dto.dart';
import 'package:crm_api_client/src/model/ief_dto.dart';
import 'package:crm_api_client/src/model/sync_visite_referentiel_dto.dart';
import 'package:crm_api_client/src/model/income_band_dto.dart';
import 'package:crm_api_client/src/model/canal_provenance_dto.dart';
import 'package:crm_api_client/src/model/sync_visite_dto.dart';
import 'package:crm_api_client/src/model/syndicat_dto.dart';
import 'package:crm_api_client/src/model/banque_dto.dart';
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

    required this.incomeBands,

    required this.canauxProvenance,

    required this.visiteReferentiels,

    required this.representants,

    required this.prospects,

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

  /// Tranches de revenu mensuel : la conversion les demande hors réseau.
  @JsonKey(name: r'incomeBands', required: true, includeIfNull: false)
  final List<IncomeBandDto> incomeBands;

  @JsonKey(name: r'canauxProvenance', required: true, includeIfNull: false)
  final List<CanalProvenanceDto> canauxProvenance;

  /// Les quatre listes du registre des visites, réunies : chaque entrée porte sa nature.
  @JsonKey(name: r'visiteReferentiels', required: true, includeIfNull: false)
  final List<SyncVisiteReferentielDto> visiteReferentiels;

  @JsonKey(name: r'representants', required: true, includeIfNull: false)
  final List<RepresentantDto> representants;

  @JsonKey(name: r'prospects', required: true, includeIfNull: false)
  final List<ProspectDto> prospects;

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
                incomeBands,
                canauxProvenance,
                visiteReferentiels,
                representants,
                prospects,
                visites,
              ],
              [
                other.departements,
                other.iefs,
                other.banques,
                other.syndicats,
                other.incomeBands,
                other.canauxProvenance,
                other.visiteReferentiels,
                other.representants,
                other.prospects,
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
        incomeBands,
        canauxProvenance,
        visiteReferentiels,
        representants,
        prospects,
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
