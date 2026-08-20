// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_referentiels_bundle_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteReferentielsBundleDtoCWProxy {
  VisiteReferentielsBundleDto entreprises(
    List<VisiteReferentielDto> entreprises,
  );

  VisiteReferentielsBundleDto directions(List<VisiteReferentielDto> directions);

  VisiteReferentielsBundleDto destinataires(
    List<VisiteReferentielDto> destinataires,
  );

  VisiteReferentielsBundleDto objets(List<VisiteReferentielDto> objets);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteReferentielsBundleDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteReferentielsBundleDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteReferentielsBundleDto call({
    List<VisiteReferentielDto> entreprises,
    List<VisiteReferentielDto> directions,
    List<VisiteReferentielDto> destinataires,
    List<VisiteReferentielDto> objets,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteReferentielsBundleDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteReferentielsBundleDto.copyWith.fieldName(...)`
class _$VisiteReferentielsBundleDtoCWProxyImpl
    implements _$VisiteReferentielsBundleDtoCWProxy {
  const _$VisiteReferentielsBundleDtoCWProxyImpl(this._value);

  final VisiteReferentielsBundleDto _value;

  @override
  VisiteReferentielsBundleDto entreprises(
    List<VisiteReferentielDto> entreprises,
  ) => this(entreprises: entreprises);

  @override
  VisiteReferentielsBundleDto directions(
    List<VisiteReferentielDto> directions,
  ) => this(directions: directions);

  @override
  VisiteReferentielsBundleDto destinataires(
    List<VisiteReferentielDto> destinataires,
  ) => this(destinataires: destinataires);

  @override
  VisiteReferentielsBundleDto objets(List<VisiteReferentielDto> objets) =>
      this(objets: objets);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteReferentielsBundleDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteReferentielsBundleDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteReferentielsBundleDto call({
    Object? entreprises = const $CopyWithPlaceholder(),
    Object? directions = const $CopyWithPlaceholder(),
    Object? destinataires = const $CopyWithPlaceholder(),
    Object? objets = const $CopyWithPlaceholder(),
  }) {
    return VisiteReferentielsBundleDto(
      entreprises: entreprises == const $CopyWithPlaceholder()
          ? _value.entreprises
          // ignore: cast_nullable_to_non_nullable
          : entreprises as List<VisiteReferentielDto>,
      directions: directions == const $CopyWithPlaceholder()
          ? _value.directions
          // ignore: cast_nullable_to_non_nullable
          : directions as List<VisiteReferentielDto>,
      destinataires: destinataires == const $CopyWithPlaceholder()
          ? _value.destinataires
          // ignore: cast_nullable_to_non_nullable
          : destinataires as List<VisiteReferentielDto>,
      objets: objets == const $CopyWithPlaceholder()
          ? _value.objets
          // ignore: cast_nullable_to_non_nullable
          : objets as List<VisiteReferentielDto>,
    );
  }
}

extension $VisiteReferentielsBundleDtoCopyWith on VisiteReferentielsBundleDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteReferentielsBundleDto.copyWith(...)` or like so:`instanceOfVisiteReferentielsBundleDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteReferentielsBundleDtoCWProxy get copyWith =>
      _$VisiteReferentielsBundleDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteReferentielsBundleDto _$VisiteReferentielsBundleDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteReferentielsBundleDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'entreprises',
      'directions',
      'destinataires',
      'objets',
    ],
  );
  final val = VisiteReferentielsBundleDto(
    entreprises: $checkedConvert(
      'entreprises',
      (v) => (v as List<dynamic>)
          .map((e) => VisiteReferentielDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    directions: $checkedConvert(
      'directions',
      (v) => (v as List<dynamic>)
          .map((e) => VisiteReferentielDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    destinataires: $checkedConvert(
      'destinataires',
      (v) => (v as List<dynamic>)
          .map((e) => VisiteReferentielDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    objets: $checkedConvert(
      'objets',
      (v) => (v as List<dynamic>)
          .map((e) => VisiteReferentielDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$VisiteReferentielsBundleDtoToJson(
  VisiteReferentielsBundleDto instance,
) => <String, dynamic>{
  'entreprises': instance.entreprises.map((e) => e.toJson()).toList(),
  'directions': instance.directions.map((e) => e.toJson()).toList(),
  'destinataires': instance.destinataires.map((e) => e.toJson()).toList(),
  'objets': instance.objets.map((e) => e.toJson()).toList(),
};
