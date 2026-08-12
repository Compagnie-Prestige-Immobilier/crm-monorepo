// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'page_meta_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PageMetaDtoCWProxy {
  PageMetaDto total(num total);

  PageMetaDto page(num page);

  PageMetaDto pageSize(num pageSize);

  PageMetaDto pageCount(num pageCount);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PageMetaDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PageMetaDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PageMetaDto call({num total, num page, num pageSize, num pageCount});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPageMetaDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPageMetaDto.copyWith.fieldName(...)`
class _$PageMetaDtoCWProxyImpl implements _$PageMetaDtoCWProxy {
  const _$PageMetaDtoCWProxyImpl(this._value);

  final PageMetaDto _value;

  @override
  PageMetaDto total(num total) => this(total: total);

  @override
  PageMetaDto page(num page) => this(page: page);

  @override
  PageMetaDto pageSize(num pageSize) => this(pageSize: pageSize);

  @override
  PageMetaDto pageCount(num pageCount) => this(pageCount: pageCount);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PageMetaDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PageMetaDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PageMetaDto call({
    Object? total = const $CopyWithPlaceholder(),
    Object? page = const $CopyWithPlaceholder(),
    Object? pageSize = const $CopyWithPlaceholder(),
    Object? pageCount = const $CopyWithPlaceholder(),
  }) {
    return PageMetaDto(
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
      page: page == const $CopyWithPlaceholder()
          ? _value.page
          // ignore: cast_nullable_to_non_nullable
          : page as num,
      pageSize: pageSize == const $CopyWithPlaceholder()
          ? _value.pageSize
          // ignore: cast_nullable_to_non_nullable
          : pageSize as num,
      pageCount: pageCount == const $CopyWithPlaceholder()
          ? _value.pageCount
          // ignore: cast_nullable_to_non_nullable
          : pageCount as num,
    );
  }
}

extension $PageMetaDtoCopyWith on PageMetaDto {
  /// Returns a callable class that can be used as follows: `instanceOfPageMetaDto.copyWith(...)` or like so:`instanceOfPageMetaDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PageMetaDtoCWProxy get copyWith => _$PageMetaDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PageMetaDto _$PageMetaDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PageMetaDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['total', 'page', 'pageSize', 'pageCount'],
      );
      final val = PageMetaDto(
        total: $checkedConvert('total', (v) => v as num),
        page: $checkedConvert('page', (v) => v as num),
        pageSize: $checkedConvert('pageSize', (v) => v as num),
        pageCount: $checkedConvert('pageCount', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$PageMetaDtoToJson(PageMetaDto instance) =>
    <String, dynamic>{
      'total': instance.total,
      'page': instance.page,
      'pageSize': instance.pageSize,
      'pageCount': instance.pageCount,
    };
