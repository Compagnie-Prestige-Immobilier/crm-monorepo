//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_representant_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateRepresentantDto {
  /// Returns a new [CreateRepresentantDto] instance.
  CreateRepresentantDto({
    this.id,

    required this.fullName,

    this.prenom,

    this.etablissement,

    required this.phone,

    this.departementId,

    this.iefId,

    this.notes,

    this.clientCreatedAt,
  });

  /// Identifiant UUID v7 généré par le client. Fourni par le mobile pour que les prospects saisis hors ligne puissent le référencer avant toute synchronisation.
  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'fullName', required: true, includeIfNull: false)
  final String fullName;

  /// Prénom, quand il a été recueilli séparément du nom complet.
  @JsonKey(name: r'prenom', required: false, includeIfNull: false)
  final String? prenom;

  /// Établissement où il exerce. Ni l’IEF ni le département.
  @JsonKey(name: r'etablissement', required: false, includeIfNull: false)
  final String? etablissement;

  /// Téléphone en saisie libre. Normalisé en E.164 par le serveur.
  @JsonKey(name: r'phone', required: true, includeIfNull: false)
  final String phone;

  /// FACULTATIF : une fiche naît normalement en tournée, où le département se déduit du secteur. La saisie manuelle ne le connaît pas toujours.
  @JsonKey(name: r'departementId', required: false, includeIfNull: false)
  final String? departementId;

  /// IEF de rattachement. FACULTATIVE : les fiches saisies avant l’arrivée de ce référentiel n’en portent pas, et la rendre obligatoire les invaliderait rétroactivement.
  @JsonKey(name: r'iefId', required: false, includeIfNull: false)
  final String? iefId;

  @JsonKey(name: r'notes', required: false, includeIfNull: false)
  final String? notes;

  /// Horodatage de la saisie sur le terrain. Défaut : maintenant. Distinct de createdAt, qui est l’arrivée en base.
  @JsonKey(name: r'clientCreatedAt', required: false, includeIfNull: false)
  final DateTime? clientCreatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateRepresentantDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                fullName,
                prenom,
                etablissement,
                phone,
                departementId,
                iefId,
                notes,
                clientCreatedAt,
              ],
              [
                other.id,
                other.fullName,
                other.prenom,
                other.etablissement,
                other.phone,
                other.departementId,
                other.iefId,
                other.notes,
                other.clientCreatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        fullName,
        prenom,
        etablissement,
        phone,
        departementId,
        iefId,
        notes,
        clientCreatedAt,
      ]);

  factory CreateRepresentantDto.fromJson(Map<String, dynamic> json) =>
      _$CreateRepresentantDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateRepresentantDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
