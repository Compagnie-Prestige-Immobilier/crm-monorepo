//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/reglage_champ_dto.dart';
import 'package:crm_api_client/src/model/champ_libre_dto.dart';
import 'package:crm_api_client/src/model/option_publique_dto.dart';
import 'package:crm_api_client/src/model/tranche_duree_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'formulaire_public_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class FormulairePublicDto {
  /// Returns a new [FormulairePublicDto] instance.
  FormulairePublicDto({
    required this.champs,

    required this.libres,

    required this.banques,

    required this.syndicats,

    required this.revenus,

    required this.professions,

    required this.dureesEtablissement,
  });

  /// Champs à rendre, dans l’ordre d’affichage, réglés par l’administrateur (EB-28). La méthode d’enrôlement et la date de rendez-vous en sont retirées : elles closent un dossier et n’appartiennent qu’au téléconseiller.
  @JsonKey(name: r'champs', required: true, includeIfNull: false)
  final List<ReglageChampDto> champs;

  @JsonKey(name: r'libres', required: true, includeIfNull: false)
  final List<ChampLibreDto> libres;

  @JsonKey(name: r'banques', required: true, includeIfNull: false)
  final List<OptionPubliqueDto> banques;

  @JsonKey(name: r'syndicats', required: true, includeIfNull: false)
  final List<OptionPubliqueDto> syndicats;

  /// Tranches de revenu mensuel.
  @JsonKey(name: r'revenus', required: true, includeIfNull: false)
  final List<OptionPubliqueDto> revenus;

  @JsonKey(name: r'professions', required: true, includeIfNull: false)
  final List<OptionPubliqueDto> professions;

  /// Tranches proposées pour `dureeEtablissementMois`, la valeur à envoyer étant `mois`.
  @JsonKey(name: r'dureesEtablissement', required: true, includeIfNull: false)
  final List<TrancheDureeDto> dureesEtablissement;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is FormulairePublicDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                champs,
                libres,
                banques,
                syndicats,
                revenus,
                professions,
                dureesEtablissement,
              ],
              [
                other.champs,
                other.libres,
                other.banques,
                other.syndicats,
                other.revenus,
                other.professions,
                other.dureesEtablissement,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        champs,
        libres,
        banques,
        syndicats,
        revenus,
        professions,
        dureesEtablissement,
      ]);

  factory FormulairePublicDto.fromJson(Map<String, dynamic> json) =>
      _$FormulairePublicDtoFromJson(json);

  Map<String, dynamic> toJson() => _$FormulairePublicDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
