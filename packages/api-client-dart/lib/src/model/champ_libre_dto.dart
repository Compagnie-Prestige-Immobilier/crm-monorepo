//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'champ_libre_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ChampLibreDto {
  /// Returns a new [ChampLibreDto] instance.
  ChampLibreDto({
    required this.id,

    required this.libelle,

    required this.type,

    required this.options,

    required this.obligatoire,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'libelle', required: true, includeIfNull: false)
  final String libelle;

  @JsonKey(
    name: r'type',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ChampLibreDtoTypeEnum.unknownDefaultOpenApi,
  )
  final ChampLibreDtoTypeEnum type;

  /// Valeurs proposées, pour le type LISTE seulement.
  @JsonKey(name: r'options', required: true, includeIfNull: false)
  final List<String> options;

  @JsonKey(name: r'obligatoire', required: true, includeIfNull: false)
  final bool obligatoire;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ChampLibreDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, libelle, type, options, obligatoire],
              [
                other.id,
                other.libelle,
                other.type,
                other.options,
                other.obligatoire,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([id, libelle, type, options, obligatoire]);

  factory ChampLibreDto.fromJson(Map<String, dynamic> json) =>
      _$ChampLibreDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ChampLibreDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ChampLibreDtoTypeEnum {
  @JsonValue(r'TEXTE')
  TEXTE(r'TEXTE'),
  @JsonValue(r'LISTE')
  LISTE(r'LISTE'),
  @JsonValue(r'OUI_NON')
  OUI_NON(r'OUI_NON'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const ChampLibreDtoTypeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
