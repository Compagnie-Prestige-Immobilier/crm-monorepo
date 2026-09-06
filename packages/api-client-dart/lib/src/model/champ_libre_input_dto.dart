//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'champ_libre_input_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ChampLibreInputDto {
  /// Returns a new [ChampLibreInputDto] instance.
  ChampLibreInputDto({
    this.id,

    required this.libelle,

    required this.type,

    this.options,

    required this.obligatoire,
  });

  /// Absent : le champ vient d’être ajouté.
  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'libelle', required: true, includeIfNull: false)
  final String libelle;

  @JsonKey(
    name: r'type',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ChampLibreInputDtoTypeEnum.unknownDefaultOpenApi,
  )
  final ChampLibreInputDtoTypeEnum type;

  @JsonKey(name: r'options', required: false, includeIfNull: false)
  final List<String>? options;

  @JsonKey(name: r'obligatoire', required: true, includeIfNull: false)
  final bool obligatoire;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ChampLibreInputDto &&
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

  factory ChampLibreInputDto.fromJson(Map<String, dynamic> json) =>
      _$ChampLibreInputDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ChampLibreInputDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ChampLibreInputDtoTypeEnum {
  @JsonValue(r'TEXTE')
  TEXTE(r'TEXTE'),
  @JsonValue(r'LISTE')
  LISTE(r'LISTE'),
  @JsonValue(r'OUI_NON')
  OUI_NON(r'OUI_NON'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const ChampLibreInputDtoTypeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
