//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/representant_suivi.dart';
import 'package:crm_api_client/src/model/representant_relation.dart';
import 'package:crm_api_client/src/model/whatsapp_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_export_query_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantExportQueryDto {
  /// Returns a new [RepresentantExportQueryDto] instance.
  RepresentantExportQueryDto({
    this.search,

    this.departementId,

    this.iefId,

    this.commercialId,

    this.dateFrom,

    this.dateTo,

    this.hasProspects,

    this.relationStatus,

    this.statutQualificationId,

    this.whatsappStatus,

    this.hasWhatsapp,

    this.suivi,

    this.lastCallById,
  });

  @JsonKey(name: r'search', required: false, includeIfNull: false)
  final String? search;

  @JsonKey(name: r'departementId', required: false, includeIfNull: false)
  final String? departementId;

  /// Filtre par IEF.
  @JsonKey(name: r'iefId', required: false, includeIfNull: false)
  final String? iefId;

  /// Réservé à l’ADMIN.
  @JsonKey(name: r'commercialId', required: false, includeIfNull: false)
  final String? commercialId;

  /// Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.
  @JsonKey(name: r'dateFrom', required: false, includeIfNull: false)
  final DateTime? dateFrom;

  /// Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.
  @JsonKey(name: r'dateTo', required: false, includeIfNull: false)
  final DateTime? dateTo;

  /// true : au moins un prospect vivant. false : aucun (représentant dormant).
  @JsonKey(name: r'hasProspects', required: false, includeIfNull: false)
  final bool? hasProspects;

  @JsonKey(
    name: r'relationStatus',
    required: false,
    includeIfNull: false,
    unknownEnumValue: RepresentantRelation.unknownDefaultOpenApi,
  )
  final RepresentantRelation? relationStatus;

  /// Statut de qualification du dernier appel. Sert le filtre de l’annuaire ET le tirage d’un lot d’appels.
  @JsonKey(
    name: r'statutQualificationId',
    required: false,
    includeIfNull: false,
  )
  final String? statutQualificationId;

  @JsonKey(
    name: r'whatsappStatus',
    required: false,
    includeIfNull: false,
    unknownEnumValue: WhatsappStatus.unknownDefaultOpenApi,
  )
  final WhatsappStatus? whatsappStatus;

  @JsonKey(name: r'hasWhatsapp', required: false, includeIfNull: false)
  final bool? hasWhatsapp;

  /// A_RAPPELER : un rappel reste dû (`nextCallbackAt`), promis ou automatique, tri par défaut sur son échéance. INJOIGNABLE : le dernier appel n’a pas abouti, tri par défaut du plus récent au plus ancien.
  @JsonKey(
    name: r'suivi',
    required: false,
    includeIfNull: false,
    unknownEnumValue: RepresentantSuivi.unknownDefaultOpenApi,
  )
  final RepresentantSuivi? suivi;

  /// Qui a passé le dernier appel. Un téléconseiller y met son propre identifiant.
  @JsonKey(name: r'lastCallById', required: false, includeIfNull: false)
  final String? lastCallById;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepresentantExportQueryDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                search,
                departementId,
                iefId,
                commercialId,
                dateFrom,
                dateTo,
                hasProspects,
                relationStatus,
                statutQualificationId,
                whatsappStatus,
                hasWhatsapp,
                suivi,
                lastCallById,
              ],
              [
                other.search,
                other.departementId,
                other.iefId,
                other.commercialId,
                other.dateFrom,
                other.dateTo,
                other.hasProspects,
                other.relationStatus,
                other.statutQualificationId,
                other.whatsappStatus,
                other.hasWhatsapp,
                other.suivi,
                other.lastCallById,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        search,
        departementId,
        iefId,
        commercialId,
        dateFrom,
        dateTo,
        hasProspects,
        relationStatus,
        statutQualificationId,
        whatsappStatus,
        hasWhatsapp,
        suivi,
        lastCallById,
      ]);

  factory RepresentantExportQueryDto.fromJson(Map<String, dynamic> json) =>
      _$RepresentantExportQueryDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantExportQueryDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
