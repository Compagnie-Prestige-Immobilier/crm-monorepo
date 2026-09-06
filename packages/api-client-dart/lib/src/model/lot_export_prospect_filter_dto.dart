//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/prospect_type.dart';
import 'package:crm_api_client/src/model/bdd_segment.dart';
import 'package:crm_api_client/src/model/phase2_status.dart';
import 'package:crm_api_client/src/model/prospect_statut.dart';
import 'package:crm_api_client/src/model/enrollment_method.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'lot_export_prospect_filter_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LotExportProspectFilterDto {
  /// Returns a new [LotExportProspectFilterDto] instance.
  LotExportProspectFilterDto({
    this.search,

    this.representantId,

    this.banqueId,

    this.syndicatId,

    this.departementId,

    this.commercialId,

    this.type,

    this.canalProvenanceId,

    this.statut,

    this.segment,

    this.phase2Status,

    this.enrollmentMethod,

    this.appelePar,

    this.lastCallById,

    this.enrollmentCapturedById,

    this.origin,

    this.dateFrom,

    this.dateTo,

    this.includeDeleted = false,

    required this.projet,
  });

  /// Recherche libre sur le nom, le prénom ou le téléphone.
  @JsonKey(name: r'search', required: false, includeIfNull: false)
  final String? search;

  @JsonKey(name: r'representantId', required: false, includeIfNull: false)
  final String? representantId;

  @JsonKey(name: r'banqueId', required: false, includeIfNull: false)
  final String? banqueId;

  @JsonKey(name: r'syndicatId', required: false, includeIfNull: false)
  final String? syndicatId;

  @JsonKey(name: r'departementId', required: false, includeIfNull: false)
  final String? departementId;

  /// Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.
  @JsonKey(name: r'commercialId', required: false, includeIfNull: false)
  final String? commercialId;

  /// Grand Public : fonctionnaire, secteur privé, informel, diaspora.
  @JsonKey(
    name: r'type',
    required: false,
    includeIfNull: false,
    unknownEnumValue: ProspectType.unknownDefaultOpenApi,
  )
  final ProspectType? type;

  /// Grand Public : canal de provenance.
  @JsonKey(name: r'canalProvenanceId', required: false, includeIfNull: false)
  final String? canalProvenanceId;

  @JsonKey(
    name: r'statut',
    required: false,
    includeIfNull: false,
    unknownEnumValue: ProspectStatut.unknownDefaultOpenApi,
  )
  final ProspectStatut? statut;

  /// Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.
  @JsonKey(
    name: r'segment',
    required: false,
    includeIfNull: false,
    unknownEnumValue: BddSegment.unknownDefaultOpenApi,
  )
  final BddSegment? segment;

  /// Avancement de la phase 2. Dimension indépendante de `statut`.
  @JsonKey(
    name: r'phase2Status',
    required: false,
    includeIfNull: false,
    unknownEnumValue: Phase2Status.unknownDefaultOpenApi,
  )
  final Phase2Status? phase2Status;

  /// Méthode d’enrôlement obtenue en phase 2.
  @JsonKey(
    name: r'enrollmentMethod',
    required: false,
    includeIfNull: false,
    unknownEnumValue: EnrollmentMethod.unknownDefaultOpenApi,
  )
  final EnrollmentMethod? enrollmentMethod;

  /// Téléconseiller ayant consigné au moins une tentative sur la fiche.
  @JsonKey(name: r'appelePar', required: false, includeIfNull: false)
  final String? appelePar;

  /// Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.
  @JsonKey(name: r'lastCallById', required: false, includeIfNull: false)
  final String? lastCallById;

  /// Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.
  @JsonKey(
    name: r'enrollmentCapturedById',
    required: false,
    includeIfNull: false,
  )
  final String? enrollmentCapturedById;

  /// Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
  @JsonKey(
    name: r'origin',
    required: false,
    includeIfNull: false,
    unknownEnumValue:
        LotExportProspectFilterDtoOriginEnum.unknownDefaultOpenApi,
  )
  final LotExportProspectFilterDtoOriginEnum? origin;

  /// Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  @JsonKey(name: r'dateFrom', required: false, includeIfNull: false)
  final DateTime? dateFrom;

  /// Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  @JsonKey(name: r'dateTo', required: false, includeIfNull: false)
  final DateTime? dateTo;

  /// Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.
  @JsonKey(
    defaultValue: false,
    name: r'includeDeleted',
    required: false,
    includeIfNull: false,
  )
  final bool? includeDeleted;

  /// Projet du lot. Il est porté par la campagne et ne se devine pas après coup.
  @JsonKey(
    name: r'projet',
    required: true,
    includeIfNull: false,
    unknownEnumValue: Projet.unknownDefaultOpenApi,
  )
  final Projet projet;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is LotExportProspectFilterDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                search,
                representantId,
                banqueId,
                syndicatId,
                departementId,
                commercialId,
                type,
                canalProvenanceId,
                statut,
                segment,
                phase2Status,
                enrollmentMethod,
                appelePar,
                lastCallById,
                enrollmentCapturedById,
                origin,
                dateFrom,
                dateTo,
                includeDeleted,
                projet,
              ],
              [
                other.search,
                other.representantId,
                other.banqueId,
                other.syndicatId,
                other.departementId,
                other.commercialId,
                other.type,
                other.canalProvenanceId,
                other.statut,
                other.segment,
                other.phase2Status,
                other.enrollmentMethod,
                other.appelePar,
                other.lastCallById,
                other.enrollmentCapturedById,
                other.origin,
                other.dateFrom,
                other.dateTo,
                other.includeDeleted,
                other.projet,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        search,
        representantId,
        banqueId,
        syndicatId,
        departementId,
        commercialId,
        type,
        canalProvenanceId,
        statut,
        segment,
        phase2Status,
        enrollmentMethod,
        appelePar,
        lastCallById,
        enrollmentCapturedById,
        origin,
        dateFrom,
        dateTo,
        includeDeleted,
        projet,
      ]);

  factory LotExportProspectFilterDto.fromJson(Map<String, dynamic> json) =>
      _$LotExportProspectFilterDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LotExportProspectFilterDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

/// Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
enum LotExportProspectFilterDtoOriginEnum {
  /// Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
  @JsonValue(r'BANQUE')
  BANQUE(r'BANQUE'),

  /// Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
  @JsonValue(r'FORMULAIRE_PUBLIC')
  FORMULAIRE_PUBLIC(r'FORMULAIRE_PUBLIC'),

  /// Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const LotExportProspectFilterDtoOriginEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
