//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/dernier_tirage_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'enrolement_reglages_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class EnrolementReglagesDto {
  /// Returns a new [EnrolementReglagesDto] instance.
  EnrolementReglagesDto({
    required this.projet,

    required this.frequenceMinutes,

    required this.repriseDepuis,

    required this.configuree,

    required this.dernierTirage,

    required this.updatedAt,
  });

  @JsonKey(
    name: r'projet',
    required: true,
    includeIfNull: false,
    unknownEnumValue: Projet.unknownDefaultOpenApi,
  )
  final Projet projet;

  @JsonKey(name: r'frequenceMinutes', required: true, includeIfNull: false)
  final num frequenceMinutes;

  /// Ne garder que les inscriptions postérieures. Nulle, le tirage reprend tout l’historique.
  @JsonKey(name: r'repriseDepuis', required: true, includeIfNull: true)
  final DateTime? repriseDepuis;

  /// L’URL et le jeton de la plateforme sont posés dans l’environnement.
  @JsonKey(name: r'configuree', required: true, includeIfNull: false)
  final bool configuree;

  @JsonKey(name: r'dernierTirage', required: true, includeIfNull: true)
  final DernierTirageDto? dernierTirage;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: true)
  final DateTime? updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is EnrolementReglagesDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                projet,
                frequenceMinutes,
                repriseDepuis,
                configuree,
                dernierTirage,
                updatedAt,
              ],
              [
                other.projet,
                other.frequenceMinutes,
                other.repriseDepuis,
                other.configuree,
                other.dernierTirage,
                other.updatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        projet,
        frequenceMinutes,
        repriseDepuis,
        configuree,
        dernierTirage,
        updatedAt,
      ]);

  factory EnrolementReglagesDto.fromJson(Map<String, dynamic> json) =>
      _$EnrolementReglagesDtoFromJson(json);

  Map<String, dynamic> toJson() => _$EnrolementReglagesDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
