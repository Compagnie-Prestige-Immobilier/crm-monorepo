// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_import_change_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteImportChangeListDtoCWProxy {
  VisiteImportChangeListDto items(List<VisiteImportChangeDto> items);

  VisiteImportChangeListDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteImportChangeListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteImportChangeListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteImportChangeListDto call({
    List<VisiteImportChangeDto> items,
    PageMetaDto meta,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteImportChangeListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteImportChangeListDto.copyWith.fieldName(...)`
class _$VisiteImportChangeListDtoCWProxyImpl
    implements _$VisiteImportChangeListDtoCWProxy {
  const _$VisiteImportChangeListDtoCWProxyImpl(this._value);

  final VisiteImportChangeListDto _value;

  @override
  VisiteImportChangeListDto items(List<VisiteImportChangeDto> items) =>
      this(items: items);

  @override
  VisiteImportChangeListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteImportChangeListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteImportChangeListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteImportChangeListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return VisiteImportChangeListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<VisiteImportChangeDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $VisiteImportChangeListDtoCopyWith on VisiteImportChangeListDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteImportChangeListDto.copyWith(...)` or like so:`instanceOfVisiteImportChangeListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteImportChangeListDtoCWProxy get copyWith =>
      _$VisiteImportChangeListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteImportChangeListDto _$VisiteImportChangeListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteImportChangeListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'meta']);
  final val = VisiteImportChangeListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => VisiteImportChangeDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    meta: $checkedConvert(
      'meta',
      (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$VisiteImportChangeListDtoToJson(
  VisiteImportChangeListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'meta': instance.meta.toJson(),
};
