// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'referentiels_bundle_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ReferentielsBundleDtoCWProxy {
  ReferentielsBundleDto banques(List<BanqueDto> banques);

  ReferentielsBundleDto syndicats(List<SyndicatDto> syndicats);

  ReferentielsBundleDto departements(List<DepartementDto> departements);

  ReferentielsBundleDto regions(List<RegionDto> regions);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReferentielsBundleDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReferentielsBundleDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReferentielsBundleDto call({
    List<BanqueDto> banques,
    List<SyndicatDto> syndicats,
    List<DepartementDto> departements,
    List<RegionDto> regions,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfReferentielsBundleDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfReferentielsBundleDto.copyWith.fieldName(...)`
class _$ReferentielsBundleDtoCWProxyImpl
    implements _$ReferentielsBundleDtoCWProxy {
  const _$ReferentielsBundleDtoCWProxyImpl(this._value);

  final ReferentielsBundleDto _value;

  @override
  ReferentielsBundleDto banques(List<BanqueDto> banques) =>
      this(banques: banques);

  @override
  ReferentielsBundleDto syndicats(List<SyndicatDto> syndicats) =>
      this(syndicats: syndicats);

  @override
  ReferentielsBundleDto departements(List<DepartementDto> departements) =>
      this(departements: departements);

  @override
  ReferentielsBundleDto regions(List<RegionDto> regions) =>
      this(regions: regions);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReferentielsBundleDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReferentielsBundleDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReferentielsBundleDto call({
    Object? banques = const $CopyWithPlaceholder(),
    Object? syndicats = const $CopyWithPlaceholder(),
    Object? departements = const $CopyWithPlaceholder(),
    Object? regions = const $CopyWithPlaceholder(),
  }) {
    return ReferentielsBundleDto(
      banques: banques == const $CopyWithPlaceholder()
          ? _value.banques
          // ignore: cast_nullable_to_non_nullable
          : banques as List<BanqueDto>,
      syndicats: syndicats == const $CopyWithPlaceholder()
          ? _value.syndicats
          // ignore: cast_nullable_to_non_nullable
          : syndicats as List<SyndicatDto>,
      departements: departements == const $CopyWithPlaceholder()
          ? _value.departements
          // ignore: cast_nullable_to_non_nullable
          : departements as List<DepartementDto>,
      regions: regions == const $CopyWithPlaceholder()
          ? _value.regions
          // ignore: cast_nullable_to_non_nullable
          : regions as List<RegionDto>,
    );
  }
}

extension $ReferentielsBundleDtoCopyWith on ReferentielsBundleDto {
  /// Returns a callable class that can be used as follows: `instanceOfReferentielsBundleDto.copyWith(...)` or like so:`instanceOfReferentielsBundleDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ReferentielsBundleDtoCWProxy get copyWith =>
      _$ReferentielsBundleDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReferentielsBundleDto _$ReferentielsBundleDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ReferentielsBundleDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['banques', 'syndicats', 'departements', 'regions'],
  );
  final val = ReferentielsBundleDto(
    banques: $checkedConvert(
      'banques',
      (v) => (v as List<dynamic>)
          .map((e) => BanqueDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    syndicats: $checkedConvert(
      'syndicats',
      (v) => (v as List<dynamic>)
          .map((e) => SyndicatDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    departements: $checkedConvert(
      'departements',
      (v) => (v as List<dynamic>)
          .map((e) => DepartementDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    regions: $checkedConvert(
      'regions',
      (v) => (v as List<dynamic>)
          .map((e) => RegionDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$ReferentielsBundleDtoToJson(
  ReferentielsBundleDto instance,
) => <String, dynamic>{
  'banques': instance.banques.map((e) => e.toJson()).toList(),
  'syndicats': instance.syndicats.map((e) => e.toJson()).toList(),
  'departements': instance.departements.map((e) => e.toJson()).toList(),
  'regions': instance.regions.map((e) => e.toJson()).toList(),
};
