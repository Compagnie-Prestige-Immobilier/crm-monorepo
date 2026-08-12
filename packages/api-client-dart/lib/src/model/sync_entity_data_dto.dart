//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/call_outcome.dart';
import 'package:crm_api_client/src/model/prospect_statut.dart';
import 'package:crm_api_client/src/model/enrollment_method.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_entity_data_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncEntityDataDto {
  /// Returns a new [SyncEntityDataDto] instance.
  SyncEntityDataDto({
    this.fullName,

    this.nom,

    this.prenom,

    this.phone,

    this.departementId,

    this.banqueId,

    this.syndicatId,

    this.representantId,

    this.statut,

    this.notes,

    this.clientCreatedAt,

    this.prospectId,

    this.outcome,

    this.method,

    this.comment,
  });

  /// Représentant : nom complet.
  @JsonKey(name: r'fullName', required: false, includeIfNull: false)
  final String? fullName;

  /// Prospect : nom.
  @JsonKey(name: r'nom', required: false, includeIfNull: false)
  final String? nom;

  /// Prospect : prénom.
  @JsonKey(name: r'prenom', required: false, includeIfNull: false)
  final String? prenom;

  /// Téléphone en saisie libre ; normalisé en E.164 par le serveur.
  @JsonKey(name: r'phone', required: false, includeIfNull: false)
  final String? phone;

  /// Représentant : département.
  @JsonKey(name: r'departementId', required: false, includeIfNull: false)
  final String? departementId;

  /// Prospect : banque.
  @JsonKey(name: r'banqueId', required: false, includeIfNull: false)
  final String? banqueId;

  /// Prospect : syndicat.
  @JsonKey(name: r'syndicatId', required: false, includeIfNull: false)
  final String? syndicatId;

  /// Prospect : représentant de rattachement. Sert aussi de clé de groupe.
  @JsonKey(name: r'representantId', required: false, includeIfNull: false)
  final String? representantId;

  @JsonKey(
    name: r'statut',
    required: false,
    includeIfNull: false,
    unknownEnumValue: ProspectStatut.unknownDefaultOpenApi,
  )
  final ProspectStatut? statut;

  /// Représentant : notes libres.
  @JsonKey(name: r'notes', required: false, includeIfNull: false)
  final String? notes;

  /// Horodatage de la saisie terrain.
  @JsonKey(name: r'clientCreatedAt', required: false, includeIfNull: false)
  final DateTime? clientCreatedAt;

  /// Tentative d’appel : prospect concerné. Sert aussi de clé de groupe.
  @JsonKey(name: r'prospectId', required: false, includeIfNull: false)
  final String? prospectId;

  @JsonKey(
    name: r'outcome',
    required: false,
    includeIfNull: false,
    unknownEnumValue: CallOutcome.unknownDefaultOpenApi,
  )
  final CallOutcome? outcome;

  /// Obligatoire si et seulement si outcome vaut METHOD_OBTAINED.
  @JsonKey(
    name: r'method',
    required: false,
    includeIfNull: false,
    unknownEnumValue: EnrollmentMethod.unknownDefaultOpenApi,
  )
  final EnrollmentMethod? method;

  /// Tentative d’appel : obligatoire et non vide si outcome vaut OTHER.
  @JsonKey(name: r'comment', required: false, includeIfNull: false)
  final String? comment;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SyncEntityDataDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                fullName,
                nom,
                prenom,
                phone,
                departementId,
                banqueId,
                syndicatId,
                representantId,
                statut,
                notes,
                clientCreatedAt,
                prospectId,
                outcome,
                method,
                comment,
              ],
              [
                other.fullName,
                other.nom,
                other.prenom,
                other.phone,
                other.departementId,
                other.banqueId,
                other.syndicatId,
                other.representantId,
                other.statut,
                other.notes,
                other.clientCreatedAt,
                other.prospectId,
                other.outcome,
                other.method,
                other.comment,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        fullName,
        nom,
        prenom,
        phone,
        departementId,
        banqueId,
        syndicatId,
        representantId,
        statut,
        notes,
        clientCreatedAt,
        prospectId,
        outcome,
        method,
        comment,
      ]);

  factory SyncEntityDataDto.fromJson(Map<String, dynamic> json) =>
      _$SyncEntityDataDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncEntityDataDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
