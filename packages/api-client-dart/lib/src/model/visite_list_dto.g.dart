// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteListDtoCWProxy {
  VisiteListDto items(List<VisiteDto> items);

  VisiteListDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteListDto call({List<VisiteDto> items, PageMetaDto meta});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteListDto.copyWith.fieldName(...)`
class _$VisiteListDtoCWProxyImpl implements _$VisiteListDtoCWProxy {
  const _$VisiteListDtoCWProxyImpl(this._value);

  final VisiteListDto _value;

  @override
  VisiteListDto items(List<VisiteDto> items) => this(items: items);

  @override
  VisiteListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return VisiteListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<VisiteDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $VisiteListDtoCopyWith on VisiteListDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteListDto.copyWith(...)` or like so:`instanceOfVisiteListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteListDtoCWProxy get copyWith => _$VisiteListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteListDto _$VisiteListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('VisiteListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'meta']);
      final val = VisiteListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => VisiteDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        meta: $checkedConvert(
          'meta',
          (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$VisiteListDtoToJson(VisiteListDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'meta': instance.meta.toJson(),
    };
