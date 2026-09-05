//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'supervision_campagne_teleconseiller_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SupervisionCampagneTeleconseillerDto {
  /// Returns a new [SupervisionCampagneTeleconseillerDto] instance.
  SupervisionCampagneTeleconseillerDto({
    required this.prevues,

    required this.appelees,

    required this.traitees,

    required this.contactRate,

    required this.exploitationRate,

    required this.teleconseillerId,

    required this.teleconseillerName,
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

  @JsonKey(name: r'teleconseillerId', required: true, includeIfNull: false)
  final String teleconseillerId;

  @JsonKey(name: r'teleconseillerName', required: true, includeIfNull: false)
  final String teleconseillerName;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SupervisionCampagneTeleconseillerDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                prevues,
                appelees,
                traitees,
                contactRate,
                exploitationRate,
                teleconseillerId,
                teleconseillerName,
              ],
              [
                other.prevues,
                other.appelees,
                other.traitees,
                other.contactRate,
                other.exploitationRate,
                other.teleconseillerId,
                other.teleconseillerName,
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
        teleconseillerId,
        teleconseillerName,
      ]);

  factory SupervisionCampagneTeleconseillerDto.fromJson(
    Map<String, dynamic> json,
  ) => _$SupervisionCampagneTeleconseillerDtoFromJson(json);

  Map<String, dynamic> toJson() =>
      _$SupervisionCampagneTeleconseillerDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
