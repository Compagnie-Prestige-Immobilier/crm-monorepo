//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/repartition_dto.dart';
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/serie_jour_dto.dart';
import 'package:crm_api_client/src/model/delai_median_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'enrolement_indicateurs_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class EnrolementIndicateursDto {
  /// Returns a new [EnrolementIndicateursDto] instance.
  EnrolementIndicateursDto({
    required this.projet,

    required this.inscriptions,

    required this.rapprochees,

    required this.tauxConversion,

    required this.tauxRapprochement,

    required this.parJour,

    required this.parEtape,

    required this.delais,

    required this.parTeleconseiller,

    required this.parCampagne,

    required this.parMethode,
  });

  @JsonKey(
    name: r'projet',
    required: true,
    includeIfNull: false,
    unknownEnumValue: Projet.unknownDefaultOpenApi,
  )
  final Projet projet;

  @JsonKey(name: r'inscriptions', required: true, includeIfNull: false)
  final num inscriptions;

  @JsonKey(name: r'rapprochees', required: true, includeIfNull: false)
  final num rapprochees;

  /// Prospects convertis du projet qui se retrouvent inscrits. Null quand aucun prospect n’est converti.
  @JsonKey(name: r'tauxConversion', required: true, includeIfNull: true)
  final num? tauxConversion;

  /// Part des inscriptions rapprochées d’un prospect. Null quand rien n’est inscrit.
  @JsonKey(name: r'tauxRapprochement', required: true, includeIfNull: true)
  final num? tauxRapprochement;

  @JsonKey(name: r'parJour', required: true, includeIfNull: false)
  final List<SerieJourDto> parJour;

  @JsonKey(name: r'parEtape', required: true, includeIfNull: false)
  final List<RepartitionDto> parEtape;

  @JsonKey(name: r'delais', required: true, includeIfNull: false)
  final List<DelaiMedianDto> delais;

  @JsonKey(name: r'parTeleconseiller', required: true, includeIfNull: false)
  final List<RepartitionDto> parTeleconseiller;

  @JsonKey(name: r'parCampagne', required: true, includeIfNull: false)
  final List<RepartitionDto> parCampagne;

  @JsonKey(name: r'parMethode', required: true, includeIfNull: false)
  final List<RepartitionDto> parMethode;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is EnrolementIndicateursDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                projet,
                inscriptions,
                rapprochees,
                tauxConversion,
                tauxRapprochement,
                parJour,
                parEtape,
                delais,
                parTeleconseiller,
                parCampagne,
                parMethode,
              ],
              [
                other.projet,
                other.inscriptions,
                other.rapprochees,
                other.tauxConversion,
                other.tauxRapprochement,
                other.parJour,
                other.parEtape,
                other.delais,
                other.parTeleconseiller,
                other.parCampagne,
                other.parMethode,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        projet,
        inscriptions,
        rapprochees,
        tauxConversion,
        tauxRapprochement,
        parJour,
        parEtape,
        delais,
        parTeleconseiller,
        parCampagne,
        parMethode,
      ]);

  factory EnrolementIndicateursDto.fromJson(Map<String, dynamic> json) =>
      _$EnrolementIndicateursDtoFromJson(json);

  Map<String, dynamic> toJson() => _$EnrolementIndicateursDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
