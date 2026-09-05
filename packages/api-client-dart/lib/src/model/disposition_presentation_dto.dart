//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'disposition_presentation_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DispositionPresentationDto {
  /// Returns a new [DispositionPresentationDto] instance.
  DispositionPresentationDto({
    this.palette,

    this.valeurs,

    this.legende,

    this.tri,

    this.autresApres,
  });

  @JsonKey(
    name: r'palette',
    required: false,
    includeIfNull: false,
    unknownEnumValue:
        DispositionPresentationDtoPaletteEnum.unknownDefaultOpenApi,
  )
  final DispositionPresentationDtoPaletteEnum? palette;

  @JsonKey(name: r'valeurs', required: false, includeIfNull: false)
  final bool? valeurs;

  @JsonKey(name: r'legende', required: false, includeIfNull: false)
  final bool? legende;

  @JsonKey(
    name: r'tri',
    required: false,
    includeIfNull: false,
    unknownEnumValue: DispositionPresentationDtoTriEnum.unknownDefaultOpenApi,
  )
  final DispositionPresentationDtoTriEnum? tri;

  // minimum: 1
  // maximum: 50
  @JsonKey(name: r'autresApres', required: false, includeIfNull: false)
  final num? autresApres;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DispositionPresentationDto &&
            runtimeType == other.runtimeType &&
            equals(
              [palette, valeurs, legende, tri, autresApres],
              [
                other.palette,
                other.valeurs,
                other.legende,
                other.tri,
                other.autresApres,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([palette, valeurs, legende, tri, autresApres]);

  factory DispositionPresentationDto.fromJson(Map<String, dynamic> json) =>
      _$DispositionPresentationDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DispositionPresentationDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum DispositionPresentationDtoPaletteEnum {
  @JsonValue(r'neutre')
  neutre(r'neutre'),
  @JsonValue(r'serie')
  serie(r'serie'),
  @JsonValue(r'categorielle')
  categorielle(r'categorielle'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const DispositionPresentationDtoPaletteEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum DispositionPresentationDtoTriEnum {
  @JsonValue(r'valeur-desc')
  valeurDesc(r'valeur-desc'),
  @JsonValue(r'valeur-asc')
  valeurAsc(r'valeur-asc'),
  @JsonValue(r'alphabetique')
  alphabetique(r'alphabetique'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const DispositionPresentationDtoTriEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
