//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'comptage_ouvertures_jour_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ComptageOuverturesJourDto {
  /// Returns a new [ComptageOuverturesJourDto] instance.
  ComptageOuverturesJourDto({
    required this.openedById,

    required this.openedByName,

    required this.jour,

    required this.ouvertures,

    required this.qualifiees,

    required this.liberees,

    required this.dureeMoyenneSecondes,
  });

  @JsonKey(name: r'openedById', required: true, includeIfNull: false)
  final String openedById;

  @JsonKey(name: r'openedByName', required: true, includeIfNull: false)
  final String openedByName;

  /// Journée de travail, Africa/Dakar.
  @JsonKey(name: r'jour', required: true, includeIfNull: false)
  final DateTime jour;

  @JsonKey(name: r'ouvertures', required: true, includeIfNull: false)
  final num ouvertures;

  /// Parmi `ouvertures`, celles closes par une qualification. Taux de qualification : `qualifiees` / `ouvertures`.
  @JsonKey(name: r'qualifiees', required: true, includeIfNull: false)
  final num qualifiees;

  /// Parmi `ouvertures`, celles libérées par un superviseur ou un administrateur.
  @JsonKey(name: r'liberees', required: true, includeIfNull: false)
  final num liberees;

  /// DMT du jour, en secondes, lue entre la première saisie et la qualification. Les ouvertures fermées sans aucune saisie n’entrent pas au dénominateur. Nulle tant qu’aucune ne s’y prête.
  @JsonKey(name: r'dureeMoyenneSecondes', required: true, includeIfNull: true)
  final num? dureeMoyenneSecondes;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ComptageOuverturesJourDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                openedById,
                openedByName,
                jour,
                ouvertures,
                qualifiees,
                liberees,
                dureeMoyenneSecondes,
              ],
              [
                other.openedById,
                other.openedByName,
                other.jour,
                other.ouvertures,
                other.qualifiees,
                other.liberees,
                other.dureeMoyenneSecondes,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        openedById,
        openedByName,
        jour,
        ouvertures,
        qualifiees,
        liberees,
        dureeMoyenneSecondes,
      ]);

  factory ComptageOuverturesJourDto.fromJson(Map<String, dynamic> json) =>
      _$ComptageOuverturesJourDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ComptageOuverturesJourDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
