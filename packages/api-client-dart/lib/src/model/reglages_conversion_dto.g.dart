// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reglages_conversion_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ReglagesConversionDtoCWProxy {
  ReglagesConversionDto projet(Projet projet);

  ReglagesConversionDto champs(List<ReglageChampDto> champs);

  ReglagesConversionDto libres(List<ChampLibreDto> libres);

  ReglagesConversionDto updatedAt(DateTime? updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReglagesConversionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReglagesConversionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReglagesConversionDto call({
    Projet projet,
    List<ReglageChampDto> champs,
    List<ChampLibreDto> libres,
    DateTime? updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfReglagesConversionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfReglagesConversionDto.copyWith.fieldName(...)`
class _$ReglagesConversionDtoCWProxyImpl
    implements _$ReglagesConversionDtoCWProxy {
  const _$ReglagesConversionDtoCWProxyImpl(this._value);

  final ReglagesConversionDto _value;

  @override
  ReglagesConversionDto projet(Projet projet) => this(projet: projet);

  @override
  ReglagesConversionDto champs(List<ReglageChampDto> champs) =>
      this(champs: champs);

  @override
  ReglagesConversionDto libres(List<ChampLibreDto> libres) =>
      this(libres: libres);

  @override
  ReglagesConversionDto updatedAt(DateTime? updatedAt) =>
      this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReglagesConversionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReglagesConversionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReglagesConversionDto call({
    Object? projet = const $CopyWithPlaceholder(),
    Object? champs = const $CopyWithPlaceholder(),
    Object? libres = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return ReglagesConversionDto(
      projet: projet == const $CopyWithPlaceholder()
          ? _value.projet
          // ignore: cast_nullable_to_non_nullable
          : projet as Projet,
      champs: champs == const $CopyWithPlaceholder()
          ? _value.champs
          // ignore: cast_nullable_to_non_nullable
          : champs as List<ReglageChampDto>,
      libres: libres == const $CopyWithPlaceholder()
          ? _value.libres
          // ignore: cast_nullable_to_non_nullable
          : libres as List<ChampLibreDto>,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime?,
    );
  }
}

extension $ReglagesConversionDtoCopyWith on ReglagesConversionDto {
  /// Returns a callable class that can be used as follows: `instanceOfReglagesConversionDto.copyWith(...)` or like so:`instanceOfReglagesConversionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ReglagesConversionDtoCWProxy get copyWith =>
      _$ReglagesConversionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReglagesConversionDto _$ReglagesConversionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ReglagesConversionDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['projet', 'champs', 'libres', 'updatedAt'],
  );
  final val = ReglagesConversionDto(
    projet: $checkedConvert(
      'projet',
      (v) => $enumDecode(
        _$ProjetEnumMap,
        v,
        unknownValue: Projet.unknownDefaultOpenApi,
      ),
    ),
    champs: $checkedConvert(
      'champs',
      (v) => (v as List<dynamic>)
          .map((e) => ReglageChampDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    libres: $checkedConvert(
      'libres',
      (v) => (v as List<dynamic>)
          .map((e) => ChampLibreDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    updatedAt: $checkedConvert(
      'updatedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$ReglagesConversionDtoToJson(
  ReglagesConversionDto instance,
) => <String, dynamic>{
  'projet': _$ProjetEnumMap[instance.projet]!,
  'champs': instance.champs.map((e) => e.toJson()).toList(),
  'libres': instance.libres.map((e) => e.toJson()).toList(),
  'updatedAt': instance.updatedAt?.toIso8601String(),
};

const _$ProjetEnumMap = {
  Projet.CHUES: 'CHUES',
  Projet.GRAND_PUBLIC: 'GRAND_PUBLIC',
  Projet.unknownDefaultOpenApi: 'unknown_default_open_api',
};
