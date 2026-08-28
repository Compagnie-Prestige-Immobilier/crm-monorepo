// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_referentiel_usage_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteReferentielUsageDtoCWProxy {
  VisiteReferentielUsageDto entreprises(
    List<VisiteReferentielUsageEntryDto> entreprises,
  );

  VisiteReferentielUsageDto directions(
    List<VisiteReferentielUsageEntryDto> directions,
  );

  VisiteReferentielUsageDto destinataires(
    List<VisiteReferentielUsageEntryDto> destinataires,
  );

  VisiteReferentielUsageDto objets(List<VisiteReferentielUsageEntryDto> objets);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteReferentielUsageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteReferentielUsageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteReferentielUsageDto call({
    List<VisiteReferentielUsageEntryDto> entreprises,
    List<VisiteReferentielUsageEntryDto> directions,
    List<VisiteReferentielUsageEntryDto> destinataires,
    List<VisiteReferentielUsageEntryDto> objets,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteReferentielUsageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteReferentielUsageDto.copyWith.fieldName(...)`
class _$VisiteReferentielUsageDtoCWProxyImpl
    implements _$VisiteReferentielUsageDtoCWProxy {
  const _$VisiteReferentielUsageDtoCWProxyImpl(this._value);

  final VisiteReferentielUsageDto _value;

  @override
  VisiteReferentielUsageDto entreprises(
    List<VisiteReferentielUsageEntryDto> entreprises,
  ) => this(entreprises: entreprises);

  @override
  VisiteReferentielUsageDto directions(
    List<VisiteReferentielUsageEntryDto> directions,
  ) => this(directions: directions);

  @override
  VisiteReferentielUsageDto destinataires(
    List<VisiteReferentielUsageEntryDto> destinataires,
  ) => this(destinataires: destinataires);

  @override
  VisiteReferentielUsageDto objets(
    List<VisiteReferentielUsageEntryDto> objets,
  ) => this(objets: objets);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteReferentielUsageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteReferentielUsageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteReferentielUsageDto call({
    Object? entreprises = const $CopyWithPlaceholder(),
    Object? directions = const $CopyWithPlaceholder(),
    Object? destinataires = const $CopyWithPlaceholder(),
    Object? objets = const $CopyWithPlaceholder(),
  }) {
    return VisiteReferentielUsageDto(
      entreprises: entreprises == const $CopyWithPlaceholder()
          ? _value.entreprises
          // ignore: cast_nullable_to_non_nullable
          : entreprises as List<VisiteReferentielUsageEntryDto>,
      directions: directions == const $CopyWithPlaceholder()
          ? _value.directions
          // ignore: cast_nullable_to_non_nullable
          : directions as List<VisiteReferentielUsageEntryDto>,
      destinataires: destinataires == const $CopyWithPlaceholder()
          ? _value.destinataires
          // ignore: cast_nullable_to_non_nullable
          : destinataires as List<VisiteReferentielUsageEntryDto>,
      objets: objets == const $CopyWithPlaceholder()
          ? _value.objets
          // ignore: cast_nullable_to_non_nullable
          : objets as List<VisiteReferentielUsageEntryDto>,
    );
  }
}

extension $VisiteReferentielUsageDtoCopyWith on VisiteReferentielUsageDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteReferentielUsageDto.copyWith(...)` or like so:`instanceOfVisiteReferentielUsageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteReferentielUsageDtoCWProxy get copyWith =>
      _$VisiteReferentielUsageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteReferentielUsageDto _$VisiteReferentielUsageDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteReferentielUsageDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'entreprises',
      'directions',
      'destinataires',
      'objets',
    ],
  );
  final val = VisiteReferentielUsageDto(
    entreprises: $checkedConvert(
      'entreprises',
      (v) => (v as List<dynamic>)
          .map(
            (e) => VisiteReferentielUsageEntryDto.fromJson(
              e as Map<String, dynamic>,
            ),
          )
          .toList(),
    ),
    directions: $checkedConvert(
      'directions',
      (v) => (v as List<dynamic>)
          .map(
            (e) => VisiteReferentielUsageEntryDto.fromJson(
              e as Map<String, dynamic>,
            ),
          )
          .toList(),
    ),
    destinataires: $checkedConvert(
      'destinataires',
      (v) => (v as List<dynamic>)
          .map(
            (e) => VisiteReferentielUsageEntryDto.fromJson(
              e as Map<String, dynamic>,
            ),
          )
          .toList(),
    ),
    objets: $checkedConvert(
      'objets',
      (v) => (v as List<dynamic>)
          .map(
            (e) => VisiteReferentielUsageEntryDto.fromJson(
              e as Map<String, dynamic>,
            ),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$VisiteReferentielUsageDtoToJson(
  VisiteReferentielUsageDto instance,
) => <String, dynamic>{
  'entreprises': instance.entreprises.map((e) => e.toJson()).toList(),
  'directions': instance.directions.map((e) => e.toJson()).toList(),
  'destinataires': instance.destinataires.map((e) => e.toJson()).toList(),
  'objets': instance.objets.map((e) => e.toJson()).toList(),
};
