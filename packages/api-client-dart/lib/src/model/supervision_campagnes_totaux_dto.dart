//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'supervision_campagnes_totaux_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SupervisionCampagnesTotauxDto {
  /// Returns a new [SupervisionCampagnesTotauxDto] instance.
  SupervisionCampagnesTotauxDto({
    required this.prevues,

    required this.appelees,

    required this.traitees,

    required this.contactRate,

    required this.exploitationRate,
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

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SupervisionCampagnesTotauxDto &&
            runtimeType == other.runtimeType &&
            equals(
              [prevues, appelees, traitees, contactRate, exploitationRate],
              [
                other.prevues,
                other.appelees,
                other.traitees,
                other.contactRate,
                other.exploitationRate,
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
      ]);

  factory SupervisionCampagnesTotauxDto.fromJson(Map<String, dynamic> json) =>
      _$SupervisionCampagnesTotauxDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisionCampagnesTotauxDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
