//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/reglage_champ_dto.dart';
import 'package:crm_api_client/src/model/champ_libre_dto.dart';
import 'package:crm_api_client/src/model/projet.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'reglages_conversion_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReglagesConversionDto {
  /// Returns a new [ReglagesConversionDto] instance.
  ReglagesConversionDto({
    required this.projet,

    required this.champs,

    required this.libres,

    required this.updatedAt,
  });

  @JsonKey(
    name: r'projet',
    required: true,
    includeIfNull: false,
    unknownEnumValue: Projet.unknownDefaultOpenApi,
  )
  final Projet projet;

  /// Dans l’ordre d’affichage. Un champ masqué n’est ni rendu ni exigé.
  @JsonKey(name: r'champs', required: true, includeIfNull: false)
  final List<ReglageChampDto> champs;

  @JsonKey(name: r'libres', required: true, includeIfNull: false)
  final List<ChampLibreDto> libres;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: true)
  final DateTime? updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ReglagesConversionDto &&
            runtimeType == other.runtimeType &&
            equals(
              [projet, champs, libres, updatedAt],
              [other.projet, other.champs, other.libres, other.updatedAt],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([projet, champs, libres, updatedAt]);

  factory ReglagesConversionDto.fromJson(Map<String, dynamic> json) =>
      _$ReglagesConversionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ReglagesConversionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
