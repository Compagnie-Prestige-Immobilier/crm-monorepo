// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'representant_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepresentantListDtoCWProxy {
  RepresentantListDto items(List<RepresentantDto> items);

  RepresentantListDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantListDto call({List<RepresentantDto> items, PageMetaDto meta});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepresentantListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepresentantListDto.copyWith.fieldName(...)`
class _$RepresentantListDtoCWProxyImpl implements _$RepresentantListDtoCWProxy {
  const _$RepresentantListDtoCWProxyImpl(this._value);

  final RepresentantListDto _value;

  @override
  RepresentantListDto items(List<RepresentantDto> items) => this(items: items);

  @override
  RepresentantListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return RepresentantListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<RepresentantDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $RepresentantListDtoCopyWith on RepresentantListDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepresentantListDto.copyWith(...)` or like so:`instanceOfRepresentantListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepresentantListDtoCWProxy get copyWith =>
      _$RepresentantListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepresentantListDto _$RepresentantListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RepresentantListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'meta']);
      final val = RepresentantListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => RepresentantDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        meta: $checkedConvert(
          'meta',
          (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$RepresentantListDtoToJson(
  RepresentantListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'meta': instance.meta.toJson(),
};
