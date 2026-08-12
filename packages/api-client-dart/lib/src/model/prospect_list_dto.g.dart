// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prospect_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ProspectListDtoCWProxy {
  ProspectListDto items(List<ProspectDto> items);

  ProspectListDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectListDto call({List<ProspectDto> items, PageMetaDto meta});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfProspectListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfProspectListDto.copyWith.fieldName(...)`
class _$ProspectListDtoCWProxyImpl implements _$ProspectListDtoCWProxy {
  const _$ProspectListDtoCWProxyImpl(this._value);

  final ProspectListDto _value;

  @override
  ProspectListDto items(List<ProspectDto> items) => this(items: items);

  @override
  ProspectListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return ProspectListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<ProspectDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $ProspectListDtoCopyWith on ProspectListDto {
  /// Returns a callable class that can be used as follows: `instanceOfProspectListDto.copyWith(...)` or like so:`instanceOfProspectListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ProspectListDtoCWProxy get copyWith => _$ProspectListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProspectListDto _$ProspectListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ProspectListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'meta']);
      final val = ProspectListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => ProspectDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        meta: $checkedConvert(
          'meta',
          (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ProspectListDtoToJson(ProspectListDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'meta': instance.meta.toJson(),
    };
