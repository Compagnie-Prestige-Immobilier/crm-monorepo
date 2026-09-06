//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/projet.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'inscription_plateforme_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class InscriptionPlateformeDto {
  /// Returns a new [InscriptionPlateformeDto] instance.
  InscriptionPlateformeDto({
    required this.id,

    required this.projet,

    required this.identifiantDistant,

    required this.nom,

    required this.prenom,

    required this.phoneE164,

    required this.email,

    required this.statutDistant,

    required this.etapeDistante,

    required this.inscriteLe,

    required this.soumiseLe,

    required this.decideeLe,

    required this.disparueLe,

    required this.prospectId,

    required this.dernierTirageAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(
    name: r'projet',
    required: true,
    includeIfNull: false,
    unknownEnumValue: Projet.unknownDefaultOpenApi,
  )
  final Projet projet;

  @JsonKey(name: r'identifiantDistant', required: true, includeIfNull: false)
  final String identifiantDistant;

  @JsonKey(name: r'nom', required: true, includeIfNull: false)
  final String nom;

  @JsonKey(name: r'prenom', required: true, includeIfNull: false)
  final String prenom;

  @JsonKey(name: r'phoneE164', required: true, includeIfNull: true)
  final String? phoneE164;

  @JsonKey(name: r'email', required: true, includeIfNull: true)
  final String? email;

  @JsonKey(name: r'statutDistant', required: true, includeIfNull: false)
  final String statutDistant;

  @JsonKey(name: r'etapeDistante', required: true, includeIfNull: true)
  final num? etapeDistante;

  @JsonKey(name: r'inscriteLe', required: true, includeIfNull: true)
  final DateTime? inscriteLe;

  @JsonKey(name: r'soumiseLe', required: true, includeIfNull: true)
  final DateTime? soumiseLe;

  @JsonKey(name: r'decideeLe', required: true, includeIfNull: true)
  final DateTime? decideeLe;

  /// Date du tirage complet qui n’a plus trouvé cette inscription sur la plateforme.
  @JsonKey(name: r'disparueLe', required: true, includeIfNull: true)
  final DateTime? disparueLe;

  @JsonKey(name: r'prospectId', required: true, includeIfNull: true)
  final String? prospectId;

  @JsonKey(name: r'dernierTirageAt', required: true, includeIfNull: false)
  final DateTime dernierTirageAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is InscriptionPlateformeDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                projet,
                identifiantDistant,
                nom,
                prenom,
                phoneE164,
                email,
                statutDistant,
                etapeDistante,
                inscriteLe,
                soumiseLe,
                decideeLe,
                disparueLe,
                prospectId,
                dernierTirageAt,
              ],
              [
                other.id,
                other.projet,
                other.identifiantDistant,
                other.nom,
                other.prenom,
                other.phoneE164,
                other.email,
                other.statutDistant,
                other.etapeDistante,
                other.inscriteLe,
                other.soumiseLe,
                other.decideeLe,
                other.disparueLe,
                other.prospectId,
                other.dernierTirageAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        projet,
        identifiantDistant,
        nom,
        prenom,
        phoneE164,
        email,
        statutDistant,
        etapeDistante,
        inscriteLe,
        soumiseLe,
        decideeLe,
        disparueLe,
        prospectId,
        dernierTirageAt,
      ]);

  factory InscriptionPlateformeDto.fromJson(Map<String, dynamic> json) =>
      _$InscriptionPlateformeDtoFromJson(json);

  Map<String, dynamic> toJson() => _$InscriptionPlateformeDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
