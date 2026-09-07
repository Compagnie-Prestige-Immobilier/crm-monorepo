// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_reglages_conversion_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateReglagesConversionDtoCWProxy {
  UpdateReglagesConversionDto champs(List<ReglageChampInputDto> champs);

  UpdateReglagesConversionDto libres(List<ChampLibreInputDto> libres);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateReglagesConversionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateReglagesConversionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateReglagesConversionDto call({
    List<ReglageChampInputDto> champs,
    List<ChampLibreInputDto> libres,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateReglagesConversionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateReglagesConversionDto.copyWith.fieldName(...)`
class _$UpdateReglagesConversionDtoCWProxyImpl
    implements _$UpdateReglagesConversionDtoCWProxy {
  const _$UpdateReglagesConversionDtoCWProxyImpl(this._value);

  final UpdateReglagesConversionDto _value;

  @override
  UpdateReglagesConversionDto champs(List<ReglageChampInputDto> champs) =>
      this(champs: champs);

  @override
  UpdateReglagesConversionDto libres(List<ChampLibreInputDto> libres) =>
      this(libres: libres);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateReglagesConversionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateReglagesConversionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateReglagesConversionDto call({
    Object? champs = const $CopyWithPlaceholder(),
    Object? libres = const $CopyWithPlaceholder(),
  }) {
    return UpdateReglagesConversionDto(
      champs: champs == const $CopyWithPlaceholder()
          ? _value.champs
          // ignore: cast_nullable_to_non_nullable
          : champs as List<ReglageChampInputDto>,
      libres: libres == const $CopyWithPlaceholder()
          ? _value.libres
          // ignore: cast_nullable_to_non_nullable
          : libres as List<ChampLibreInputDto>,
    );
  }
}

extension $UpdateReglagesConversionDtoCopyWith on UpdateReglagesConversionDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateReglagesConversionDto.copyWith(...)` or like so:`instanceOfUpdateReglagesConversionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateReglagesConversionDtoCWProxy get copyWith =>
      _$UpdateReglagesConversionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateReglagesConversionDto _$UpdateReglagesConversionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateReglagesConversionDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['champs', 'libres']);
  final val = UpdateReglagesConversionDto(
    champs: $checkedConvert(
      'champs',
      (v) => (v as List<dynamic>)
          .map((e) => ReglageChampInputDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    libres: $checkedConvert(
      'libres',
      (v) => (v as List<dynamic>)
          .map((e) => ChampLibreInputDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$UpdateReglagesConversionDtoToJson(
  UpdateReglagesConversionDto instance,
) => <String, dynamic>{
  'champs': instance.champs.map((e) => e.toJson()).toList(),
  'libres': instance.libres.map((e) => e.toJson()).toList(),
};
