//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/data_quality_row_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'data_quality_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DataQualityDto {
  /// Returns a new [DataQualityDto] instance.
  DataQualityDto({
    required this.representants,

    required this.departements,

    required this.attempts,

    required this.badRate,
  });

  /// Par représentant apporteur de la fiche appelée.
  @JsonKey(name: r'representants', required: true, includeIfNull: false)
  final List<DataQualityRowDto> representants;

  /// Par département de rattachement du représentant.
  @JsonKey(name: r'departements', required: true, includeIfNull: false)
  final List<DataQualityRowDto> departements;

  /// Tentatives observées, toutes lignes confondues.
  @JsonKey(name: r'attempts', required: true, includeIfNull: false)
  final num attempts;

  /// Part globale de numéros inexploitables, en %. Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.
  @JsonKey(name: r'badRate', required: true, includeIfNull: true)
  final num? badRate;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DataQualityDto &&
            runtimeType == other.runtimeType &&
            equals(
              [representants, departements, attempts, badRate],
              [
                other.representants,
                other.departements,
                other.attempts,
                other.badRate,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([representants, departements, attempts, badRate]);

  factory DataQualityDto.fromJson(Map<String, dynamic> json) =>
      _$DataQualityDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DataQualityDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
