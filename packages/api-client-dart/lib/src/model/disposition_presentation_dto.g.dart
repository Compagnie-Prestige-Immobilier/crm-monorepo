// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'disposition_presentation_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DispositionPresentationDtoCWProxy {
  DispositionPresentationDto palette(
    DispositionPresentationDtoPaletteEnum? palette,
  );

  DispositionPresentationDto valeurs(bool? valeurs);

  DispositionPresentationDto legende(bool? legende);

  DispositionPresentationDto tri(DispositionPresentationDtoTriEnum? tri);

  DispositionPresentationDto autresApres(num? autresApres);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DispositionPresentationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DispositionPresentationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DispositionPresentationDto call({
    DispositionPresentationDtoPaletteEnum? palette,
    bool? valeurs,
    bool? legende,
    DispositionPresentationDtoTriEnum? tri,
    num? autresApres,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDispositionPresentationDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDispositionPresentationDto.copyWith.fieldName(...)`
class _$DispositionPresentationDtoCWProxyImpl
    implements _$DispositionPresentationDtoCWProxy {
  const _$DispositionPresentationDtoCWProxyImpl(this._value);

  final DispositionPresentationDto _value;

  @override
  DispositionPresentationDto palette(
    DispositionPresentationDtoPaletteEnum? palette,
  ) => this(palette: palette);

  @override
  DispositionPresentationDto valeurs(bool? valeurs) => this(valeurs: valeurs);

  @override
  DispositionPresentationDto legende(bool? legende) => this(legende: legende);

  @override
  DispositionPresentationDto tri(DispositionPresentationDtoTriEnum? tri) =>
      this(tri: tri);

  @override
  DispositionPresentationDto autresApres(num? autresApres) =>
      this(autresApres: autresApres);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DispositionPresentationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DispositionPresentationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DispositionPresentationDto call({
    Object? palette = const $CopyWithPlaceholder(),
    Object? valeurs = const $CopyWithPlaceholder(),
    Object? legende = const $CopyWithPlaceholder(),
    Object? tri = const $CopyWithPlaceholder(),
    Object? autresApres = const $CopyWithPlaceholder(),
  }) {
    return DispositionPresentationDto(
      palette: palette == const $CopyWithPlaceholder()
          ? _value.palette
          // ignore: cast_nullable_to_non_nullable
          : palette as DispositionPresentationDtoPaletteEnum?,
      valeurs: valeurs == const $CopyWithPlaceholder()
          ? _value.valeurs
          // ignore: cast_nullable_to_non_nullable
          : valeurs as bool?,
      legende: legende == const $CopyWithPlaceholder()
          ? _value.legende
          // ignore: cast_nullable_to_non_nullable
          : legende as bool?,
      tri: tri == const $CopyWithPlaceholder()
          ? _value.tri
          // ignore: cast_nullable_to_non_nullable
          : tri as DispositionPresentationDtoTriEnum?,
      autresApres: autresApres == const $CopyWithPlaceholder()
          ? _value.autresApres
          // ignore: cast_nullable_to_non_nullable
          : autresApres as num?,
    );
  }
}

extension $DispositionPresentationDtoCopyWith on DispositionPresentationDto {
  /// Returns a callable class that can be used as follows: `instanceOfDispositionPresentationDto.copyWith(...)` or like so:`instanceOfDispositionPresentationDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DispositionPresentationDtoCWProxy get copyWith =>
      _$DispositionPresentationDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DispositionPresentationDto _$DispositionPresentationDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('DispositionPresentationDto', json, ($checkedConvert) {
  final val = DispositionPresentationDto(
    palette: $checkedConvert(
      'palette',
      (v) => $enumDecodeNullable(
        _$DispositionPresentationDtoPaletteEnumEnumMap,
        v,
        unknownValue:
            DispositionPresentationDtoPaletteEnum.unknownDefaultOpenApi,
      ),
    ),
    valeurs: $checkedConvert('valeurs', (v) => v as bool?),
    legende: $checkedConvert('legende', (v) => v as bool?),
    tri: $checkedConvert(
      'tri',
      (v) => $enumDecodeNullable(
        _$DispositionPresentationDtoTriEnumEnumMap,
        v,
        unknownValue: DispositionPresentationDtoTriEnum.unknownDefaultOpenApi,
      ),
    ),
    autresApres: $checkedConvert('autresApres', (v) => v as num?),
  );
  return val;
});

Map<String, dynamic> _$DispositionPresentationDtoToJson(
  DispositionPresentationDto instance,
) => <String, dynamic>{
  if (_$DispositionPresentationDtoPaletteEnumEnumMap[instance.palette]
      case final value?)
    'palette': value,
  if (instance.valeurs case final value?) 'valeurs': value,
  if (instance.legende case final value?) 'legende': value,
  if (_$DispositionPresentationDtoTriEnumEnumMap[instance.tri]
      case final value?)
    'tri': value,
  if (instance.autresApres case final value?) 'autresApres': value,
};

const _$DispositionPresentationDtoPaletteEnumEnumMap = {
  DispositionPresentationDtoPaletteEnum.neutre: 'neutre',
  DispositionPresentationDtoPaletteEnum.serie: 'serie',
  DispositionPresentationDtoPaletteEnum.categorielle: 'categorielle',
  DispositionPresentationDtoPaletteEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};

const _$DispositionPresentationDtoTriEnumEnumMap = {
  DispositionPresentationDtoTriEnum.valeurDesc: 'valeur-desc',
  DispositionPresentationDtoTriEnum.valeurAsc: 'valeur-asc',
  DispositionPresentationDtoTriEnum.alphabetique: 'alphabetique',
  DispositionPresentationDtoTriEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
