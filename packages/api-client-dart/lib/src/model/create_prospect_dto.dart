//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/prospect_type.dart';
import 'package:crm_api_client/src/model/prospect_statut.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_prospect_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateProspectDto {
  /// Returns a new [CreateProspectDto] instance.
  CreateProspectDto({
    this.id,

    required this.nom,

    this.prenom,

    required this.phone,

    this.banqueId,

    this.syndicatId,

    this.representantId,

    this.projet,

    this.type,

    this.profession,

    this.dureeSystemeMois,

    this.canalProvenanceId,

    this.statut,

    this.clientCreatedAt,
  });

  /// Identifiant UUID v7 généré par le client. Généré côté serveur s’il est absent.
  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'nom', required: true, includeIfNull: false)
  final String nom;

  @JsonKey(name: r'prenom', required: false, includeIfNull: false)
  final String? prenom;

  /// Téléphone en saisie libre. Normalisé en E.164 par le serveur.
  @JsonKey(name: r'phone', required: true, includeIfNull: false)
  final String phone;

  @JsonKey(name: r'banqueId', required: false, includeIfNull: false)
  final String? banqueId;

  @JsonKey(name: r'syndicatId', required: false, includeIfNull: false)
  final String? syndicatId;

  @JsonKey(name: r'representantId', required: false, includeIfNull: false)
  final String? representantId;

  /// CHUES par défaut. Les deux projets ne se mélangent nulle part.
  @JsonKey(
    name: r'projet',
    required: false,
    includeIfNull: false,
    unknownEnumValue: Projet.unknownDefaultOpenApi,
  )
  final Projet? projet;

  @JsonKey(
    name: r'type',
    required: false,
    includeIfNull: false,
    unknownEnumValue: ProspectType.unknownDefaultOpenApi,
  )
  final ProspectType? type;

  /// Métier déclaré, en clair.
  @JsonKey(name: r'profession', required: false, includeIfNull: false)
  final String? profession;

  /// Durée du système de paiement, en MOIS.
  // minimum: 1
  // maximum: 600
  @JsonKey(name: r'dureeSystemeMois', required: false, includeIfNull: false)
  final num? dureeSystemeMois;

  /// Canal de provenance, choisi dans le référentiel.
  @JsonKey(name: r'canalProvenanceId', required: false, includeIfNull: false)
  final String? canalProvenanceId;

  @JsonKey(
    name: r'statut',
    required: false,
    includeIfNull: false,
    unknownEnumValue: ProspectStatut.unknownDefaultOpenApi,
  )
  final ProspectStatut? statut;

  /// Horodatage de la saisie terrain.
  @JsonKey(name: r'clientCreatedAt', required: false, includeIfNull: false)
  final DateTime? clientCreatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateProspectDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                nom,
                prenom,
                phone,
                banqueId,
                syndicatId,
                representantId,
                projet,
                type,
                profession,
                dureeSystemeMois,
                canalProvenanceId,
                statut,
                clientCreatedAt,
              ],
              [
                other.id,
                other.nom,
                other.prenom,
                other.phone,
                other.banqueId,
                other.syndicatId,
                other.representantId,
                other.projet,
                other.type,
                other.profession,
                other.dureeSystemeMois,
                other.canalProvenanceId,
                other.statut,
                other.clientCreatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        nom,
        prenom,
        phone,
        banqueId,
        syndicatId,
        representantId,
        projet,
        type,
        profession,
        dureeSystemeMois,
        canalProvenanceId,
        statut,
        clientCreatedAt,
      ]);

  factory CreateProspectDto.fromJson(Map<String, dynamic> json) =>
      _$CreateProspectDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateProspectDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
