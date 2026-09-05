//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/supervision_campagne_teleconseiller_dto.dart';
import 'package:crm_api_client/src/model/lot_export_cible.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'supervision_campagne_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SupervisionCampagneDto {
  /// Returns a new [SupervisionCampagneDto] instance.
  SupervisionCampagneDto({
    required this.prevues,

    required this.appelees,

    required this.traitees,

    required this.contactRate,

    required this.exploitationRate,

    required this.id,

    required this.name,

    required this.cible,

    required this.createdAt,

    required this.parTeleconseiller,
  });

  /// Fiches confiées pour les jours de programme de la fenêtre.
  @JsonKey(name: r'prevues', required: true, includeIfNull: false)
  final num prevues;

  /// Parmi `prevues`, celles qui ont reçu au moins un appel.
  @JsonKey(name: r'appelees', required: true, includeIfNull: false)
  final num appelees;

  /// Parmi `prevues`, celles qui portent au moins une qualification.
  @JsonKey(name: r'traitees', required: true, includeIfNull: false)
  final num traitees;

  /// Taux de contact : `appelees` / `prevues`. `null` sans fiche prévue.
  @JsonKey(name: r'contactRate', required: true, includeIfNull: true)
  final num? contactRate;

  /// Taux d’exploitation : `traitees` / `prevues`. `null` sans fiche prévue.
  @JsonKey(name: r'exploitationRate', required: true, includeIfNull: true)
  final num? exploitationRate;

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(
    name: r'cible',
    required: true,
    includeIfNull: false,
    unknownEnumValue: LotExportCible.unknownDefaultOpenApi,
  )
  final LotExportCible cible;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  @JsonKey(name: r'parTeleconseiller', required: true, includeIfNull: false)
  final List<SupervisionCampagneTeleconseillerDto> parTeleconseiller;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SupervisionCampagneDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                prevues,
                appelees,
                traitees,
                contactRate,
                exploitationRate,
                id,
                name,
                cible,
                createdAt,
                parTeleconseiller,
              ],
              [
                other.prevues,
                other.appelees,
                other.traitees,
                other.contactRate,
                other.exploitationRate,
                other.id,
                other.name,
                other.cible,
                other.createdAt,
                other.parTeleconseiller,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        prevues,
        appelees,
        traitees,
        contactRate,
        exploitationRate,
        id,
        name,
        cible,
        createdAt,
        parTeleconseiller,
      ]);

  factory SupervisionCampagneDto.fromJson(Map<String, dynamic> json) =>
      _$SupervisionCampagneDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisionCampagneDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
