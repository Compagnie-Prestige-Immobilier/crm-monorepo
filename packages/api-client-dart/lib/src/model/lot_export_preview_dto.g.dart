// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lot_export_preview_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LotExportPreviewDtoCWProxy {
  LotExportPreviewDto eligible(num eligible);

  LotExportPreviewDto scopeLabel(String scopeLabel);

  LotExportPreviewDto places(num places);

  LotExportPreviewDto retenues(num retenues);

  LotExportPreviewDto parTeleconseiller(num parTeleconseiller);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportPreviewDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportPreviewDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportPreviewDto call({
    num eligible,
    String scopeLabel,
    num places,
    num retenues,
    num parTeleconseiller,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLotExportPreviewDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLotExportPreviewDto.copyWith.fieldName(...)`
class _$LotExportPreviewDtoCWProxyImpl implements _$LotExportPreviewDtoCWProxy {
  const _$LotExportPreviewDtoCWProxyImpl(this._value);

  final LotExportPreviewDto _value;

  @override
  LotExportPreviewDto eligible(num eligible) => this(eligible: eligible);

  @override
  LotExportPreviewDto scopeLabel(String scopeLabel) =>
      this(scopeLabel: scopeLabel);

  @override
  LotExportPreviewDto places(num places) => this(places: places);

  @override
  LotExportPreviewDto retenues(num retenues) => this(retenues: retenues);

  @override
  LotExportPreviewDto parTeleconseiller(num parTeleconseiller) =>
      this(parTeleconseiller: parTeleconseiller);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportPreviewDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportPreviewDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportPreviewDto call({
    Object? eligible = const $CopyWithPlaceholder(),
    Object? scopeLabel = const $CopyWithPlaceholder(),
    Object? places = const $CopyWithPlaceholder(),
    Object? retenues = const $CopyWithPlaceholder(),
    Object? parTeleconseiller = const $CopyWithPlaceholder(),
  }) {
    return LotExportPreviewDto(
      eligible: eligible == const $CopyWithPlaceholder()
          ? _value.eligible
          // ignore: cast_nullable_to_non_nullable
          : eligible as num,
      scopeLabel: scopeLabel == const $CopyWithPlaceholder()
          ? _value.scopeLabel
          // ignore: cast_nullable_to_non_nullable
          : scopeLabel as String,
      places: places == const $CopyWithPlaceholder()
          ? _value.places
          // ignore: cast_nullable_to_non_nullable
          : places as num,
      retenues: retenues == const $CopyWithPlaceholder()
          ? _value.retenues
          // ignore: cast_nullable_to_non_nullable
          : retenues as num,
      parTeleconseiller: parTeleconseiller == const $CopyWithPlaceholder()
          ? _value.parTeleconseiller
          // ignore: cast_nullable_to_non_nullable
          : parTeleconseiller as num,
    );
  }
}

extension $LotExportPreviewDtoCopyWith on LotExportPreviewDto {
  /// Returns a callable class that can be used as follows: `instanceOfLotExportPreviewDto.copyWith(...)` or like so:`instanceOfLotExportPreviewDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LotExportPreviewDtoCWProxy get copyWith =>
      _$LotExportPreviewDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LotExportPreviewDto _$LotExportPreviewDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LotExportPreviewDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'eligible',
          'scopeLabel',
          'places',
          'retenues',
          'parTeleconseiller',
        ],
      );
      final val = LotExportPreviewDto(
        eligible: $checkedConvert('eligible', (v) => v as num),
        scopeLabel: $checkedConvert('scopeLabel', (v) => v as String),
        places: $checkedConvert('places', (v) => v as num),
        retenues: $checkedConvert('retenues', (v) => v as num),
        parTeleconseiller: $checkedConvert(
          'parTeleconseiller',
          (v) => v as num,
        ),
      );
      return val;
    });

Map<String, dynamic> _$LotExportPreviewDtoToJson(
  LotExportPreviewDto instance,
) => <String, dynamic>{
  'eligible': instance.eligible,
  'scopeLabel': instance.scopeLabel,
  'places': instance.places,
  'retenues': instance.retenues,
  'parTeleconseiller': instance.parTeleconseiller,
};
