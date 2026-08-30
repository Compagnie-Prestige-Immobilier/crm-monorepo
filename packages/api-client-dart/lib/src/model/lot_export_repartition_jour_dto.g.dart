// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lot_export_repartition_jour_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LotExportRepartitionJourDtoCWProxy {
  LotExportRepartitionJourDto jour(num jour);

  LotExportRepartitionJourDto fiches(num fiches);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportRepartitionJourDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportRepartitionJourDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportRepartitionJourDto call({num jour, num fiches});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLotExportRepartitionJourDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLotExportRepartitionJourDto.copyWith.fieldName(...)`
class _$LotExportRepartitionJourDtoCWProxyImpl
    implements _$LotExportRepartitionJourDtoCWProxy {
  const _$LotExportRepartitionJourDtoCWProxyImpl(this._value);

  final LotExportRepartitionJourDto _value;

  @override
  LotExportRepartitionJourDto jour(num jour) => this(jour: jour);

  @override
  LotExportRepartitionJourDto fiches(num fiches) => this(fiches: fiches);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportRepartitionJourDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportRepartitionJourDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportRepartitionJourDto call({
    Object? jour = const $CopyWithPlaceholder(),
    Object? fiches = const $CopyWithPlaceholder(),
  }) {
    return LotExportRepartitionJourDto(
      jour: jour == const $CopyWithPlaceholder()
          ? _value.jour
          // ignore: cast_nullable_to_non_nullable
          : jour as num,
      fiches: fiches == const $CopyWithPlaceholder()
          ? _value.fiches
          // ignore: cast_nullable_to_non_nullable
          : fiches as num,
    );
  }
}

extension $LotExportRepartitionJourDtoCopyWith on LotExportRepartitionJourDto {
  /// Returns a callable class that can be used as follows: `instanceOfLotExportRepartitionJourDto.copyWith(...)` or like so:`instanceOfLotExportRepartitionJourDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LotExportRepartitionJourDtoCWProxy get copyWith =>
      _$LotExportRepartitionJourDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LotExportRepartitionJourDto _$LotExportRepartitionJourDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('LotExportRepartitionJourDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['jour', 'fiches']);
  final val = LotExportRepartitionJourDto(
    jour: $checkedConvert('jour', (v) => v as num),
    fiches: $checkedConvert('fiches', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$LotExportRepartitionJourDtoToJson(
  LotExportRepartitionJourDto instance,
) => <String, dynamic>{'jour': instance.jour, 'fiches': instance.fiches};
