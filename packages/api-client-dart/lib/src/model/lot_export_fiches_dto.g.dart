// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lot_export_fiches_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LotExportFichesDtoCWProxy {
  LotExportFichesDto items(List<LotExportFicheDto> items);

  LotExportFichesDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportFichesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportFichesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportFichesDto call({List<LotExportFicheDto> items, PageMetaDto meta});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLotExportFichesDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLotExportFichesDto.copyWith.fieldName(...)`
class _$LotExportFichesDtoCWProxyImpl implements _$LotExportFichesDtoCWProxy {
  const _$LotExportFichesDtoCWProxyImpl(this._value);

  final LotExportFichesDto _value;

  @override
  LotExportFichesDto items(List<LotExportFicheDto> items) => this(items: items);

  @override
  LotExportFichesDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportFichesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportFichesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportFichesDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return LotExportFichesDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<LotExportFicheDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $LotExportFichesDtoCopyWith on LotExportFichesDto {
  /// Returns a callable class that can be used as follows: `instanceOfLotExportFichesDto.copyWith(...)` or like so:`instanceOfLotExportFichesDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LotExportFichesDtoCWProxy get copyWith =>
      _$LotExportFichesDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LotExportFichesDto _$LotExportFichesDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LotExportFichesDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'meta']);
      final val = LotExportFichesDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => LotExportFicheDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        meta: $checkedConvert(
          'meta',
          (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$LotExportFichesDtoToJson(LotExportFichesDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'meta': instance.meta.toJson(),
    };
