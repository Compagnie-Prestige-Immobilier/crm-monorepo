// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'formulaire_public_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$FormulairePublicDtoCWProxy {
  FormulairePublicDto champs(List<ReglageChampDto> champs);

  FormulairePublicDto libres(List<ChampLibreDto> libres);

  FormulairePublicDto banques(List<OptionPubliqueDto> banques);

  FormulairePublicDto syndicats(List<OptionPubliqueDto> syndicats);

  FormulairePublicDto revenus(List<OptionPubliqueDto> revenus);

  FormulairePublicDto professions(List<OptionPubliqueDto> professions);

  FormulairePublicDto dureesEtablissement(
    List<TrancheDureeDto> dureesEtablissement,
  );

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `FormulairePublicDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// FormulairePublicDto(...).copyWith(id: 12, name: "My name")
  /// ````
  FormulairePublicDto call({
    List<ReglageChampDto> champs,
    List<ChampLibreDto> libres,
    List<OptionPubliqueDto> banques,
    List<OptionPubliqueDto> syndicats,
    List<OptionPubliqueDto> revenus,
    List<OptionPubliqueDto> professions,
    List<TrancheDureeDto> dureesEtablissement,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfFormulairePublicDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfFormulairePublicDto.copyWith.fieldName(...)`
class _$FormulairePublicDtoCWProxyImpl implements _$FormulairePublicDtoCWProxy {
  const _$FormulairePublicDtoCWProxyImpl(this._value);

  final FormulairePublicDto _value;

  @override
  FormulairePublicDto champs(List<ReglageChampDto> champs) =>
      this(champs: champs);

  @override
  FormulairePublicDto libres(List<ChampLibreDto> libres) =>
      this(libres: libres);

  @override
  FormulairePublicDto banques(List<OptionPubliqueDto> banques) =>
      this(banques: banques);

  @override
  FormulairePublicDto syndicats(List<OptionPubliqueDto> syndicats) =>
      this(syndicats: syndicats);

  @override
  FormulairePublicDto revenus(List<OptionPubliqueDto> revenus) =>
      this(revenus: revenus);

  @override
  FormulairePublicDto professions(List<OptionPubliqueDto> professions) =>
      this(professions: professions);

  @override
  FormulairePublicDto dureesEtablissement(
    List<TrancheDureeDto> dureesEtablissement,
  ) => this(dureesEtablissement: dureesEtablissement);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `FormulairePublicDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// FormulairePublicDto(...).copyWith(id: 12, name: "My name")
  /// ````
  FormulairePublicDto call({
    Object? champs = const $CopyWithPlaceholder(),
    Object? libres = const $CopyWithPlaceholder(),
    Object? banques = const $CopyWithPlaceholder(),
    Object? syndicats = const $CopyWithPlaceholder(),
    Object? revenus = const $CopyWithPlaceholder(),
    Object? professions = const $CopyWithPlaceholder(),
    Object? dureesEtablissement = const $CopyWithPlaceholder(),
  }) {
    return FormulairePublicDto(
      champs: champs == const $CopyWithPlaceholder()
          ? _value.champs
          // ignore: cast_nullable_to_non_nullable
          : champs as List<ReglageChampDto>,
      libres: libres == const $CopyWithPlaceholder()
          ? _value.libres
          // ignore: cast_nullable_to_non_nullable
          : libres as List<ChampLibreDto>,
      banques: banques == const $CopyWithPlaceholder()
          ? _value.banques
          // ignore: cast_nullable_to_non_nullable
          : banques as List<OptionPubliqueDto>,
      syndicats: syndicats == const $CopyWithPlaceholder()
          ? _value.syndicats
          // ignore: cast_nullable_to_non_nullable
          : syndicats as List<OptionPubliqueDto>,
      revenus: revenus == const $CopyWithPlaceholder()
          ? _value.revenus
          // ignore: cast_nullable_to_non_nullable
          : revenus as List<OptionPubliqueDto>,
      professions: professions == const $CopyWithPlaceholder()
          ? _value.professions
          // ignore: cast_nullable_to_non_nullable
          : professions as List<OptionPubliqueDto>,
      dureesEtablissement: dureesEtablissement == const $CopyWithPlaceholder()
          ? _value.dureesEtablissement
          // ignore: cast_nullable_to_non_nullable
          : dureesEtablissement as List<TrancheDureeDto>,
    );
  }
}

extension $FormulairePublicDtoCopyWith on FormulairePublicDto {
  /// Returns a callable class that can be used as follows: `instanceOfFormulairePublicDto.copyWith(...)` or like so:`instanceOfFormulairePublicDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$FormulairePublicDtoCWProxy get copyWith =>
      _$FormulairePublicDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FormulairePublicDto _$FormulairePublicDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('FormulairePublicDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'champs',
          'libres',
          'banques',
          'syndicats',
          'revenus',
          'professions',
          'dureesEtablissement',
        ],
      );
      final val = FormulairePublicDto(
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
        banques: $checkedConvert(
          'banques',
          (v) => (v as List<dynamic>)
              .map((e) => OptionPubliqueDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        syndicats: $checkedConvert(
          'syndicats',
          (v) => (v as List<dynamic>)
              .map((e) => OptionPubliqueDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        revenus: $checkedConvert(
          'revenus',
          (v) => (v as List<dynamic>)
              .map((e) => OptionPubliqueDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        professions: $checkedConvert(
          'professions',
          (v) => (v as List<dynamic>)
              .map((e) => OptionPubliqueDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        dureesEtablissement: $checkedConvert(
          'dureesEtablissement',
          (v) => (v as List<dynamic>)
              .map((e) => TrancheDureeDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$FormulairePublicDtoToJson(
  FormulairePublicDto instance,
) => <String, dynamic>{
  'champs': instance.champs.map((e) => e.toJson()).toList(),
  'libres': instance.libres.map((e) => e.toJson()).toList(),
  'banques': instance.banques.map((e) => e.toJson()).toList(),
  'syndicats': instance.syndicats.map((e) => e.toJson()).toList(),
  'revenus': instance.revenus.map((e) => e.toJson()).toList(),
  'professions': instance.professions.map((e) => e.toJson()).toList(),
  'dureesEtablissement': instance.dureesEtablissement
      .map((e) => e.toJson())
      .toList(),
};
