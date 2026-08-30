// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lot_export_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LotExportListDtoCWProxy {
  LotExportListDto items(List<LotExportSummaryDto> items);

  LotExportListDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportListDto call({List<LotExportSummaryDto> items, PageMetaDto meta});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLotExportListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLotExportListDto.copyWith.fieldName(...)`
class _$LotExportListDtoCWProxyImpl implements _$LotExportListDtoCWProxy {
  const _$LotExportListDtoCWProxyImpl(this._value);

  final LotExportListDto _value;

  @override
  LotExportListDto items(List<LotExportSummaryDto> items) => this(items: items);

  @override
  LotExportListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return LotExportListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<LotExportSummaryDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $LotExportListDtoCopyWith on LotExportListDto {
  /// Returns a callable class that can be used as follows: `instanceOfLotExportListDto.copyWith(...)` or like so:`instanceOfLotExportListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LotExportListDtoCWProxy get copyWith => _$LotExportListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LotExportListDto _$LotExportListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LotExportListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'meta']);
      final val = LotExportListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map(
                (e) => LotExportSummaryDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
        meta: $checkedConvert(
          'meta',
          (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$LotExportListDtoToJson(LotExportListDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'meta': instance.meta.toJson(),
    };
