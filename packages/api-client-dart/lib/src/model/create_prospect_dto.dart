//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
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

    required this.prenom,

    required this.phone,

    required this.banqueId,

    required this.syndicatId,

    required this.representantId,

    this.statut,

    this.clientCreatedAt,
  });

  /// Identifiant UUID v7 généré par le client. Généré côté serveur s’il est absent.
  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'nom', required: true, includeIfNull: false)
  final String nom;

  @JsonKey(name: r'prenom', required: true, includeIfNull: false)
  final String prenom;

  /// Téléphone en saisie libre. Normalisé en E.164 par le serveur.
  @JsonKey(name: r'phone', required: true, includeIfNull: false)
  final String phone;

  @JsonKey(name: r'banqueId', required: true, includeIfNull: false)
  final String banqueId;

  @JsonKey(name: r'syndicatId', required: true, includeIfNull: false)
  final String syndicatId;

  @JsonKey(name: r'representantId', required: true, includeIfNull: false)
  final String representantId;

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
