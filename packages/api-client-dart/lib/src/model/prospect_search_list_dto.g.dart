// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prospect_search_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ProspectSearchListDtoCWProxy {
  ProspectSearchListDto items(List<ProspectSearchItemDto> items);

  ProspectSearchListDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectSearchListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectSearchListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectSearchListDto call({
    List<ProspectSearchItemDto> items,
    PageMetaDto meta,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfProspectSearchListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfProspectSearchListDto.copyWith.fieldName(...)`
class _$ProspectSearchListDtoCWProxyImpl
    implements _$ProspectSearchListDtoCWProxy {
  const _$ProspectSearchListDtoCWProxyImpl(this._value);

  final ProspectSearchListDto _value;

  @override
  ProspectSearchListDto items(List<ProspectSearchItemDto> items) =>
      this(items: items);

  @override
  ProspectSearchListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectSearchListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectSearchListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectSearchListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return ProspectSearchListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<ProspectSearchItemDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $ProspectSearchListDtoCopyWith on ProspectSearchListDto {
  /// Returns a callable class that can be used as follows: `instanceOfProspectSearchListDto.copyWith(...)` or like so:`instanceOfProspectSearchListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ProspectSearchListDtoCWProxy get copyWith =>
      _$ProspectSearchListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProspectSearchListDto _$ProspectSearchListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ProspectSearchListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'meta']);
  final val = ProspectSearchListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => ProspectSearchItemDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    meta: $checkedConvert(
      'meta',
      (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$ProspectSearchListDtoToJson(
  ProspectSearchListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'meta': instance.meta.toJson(),
};
