// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'phase2_page_meta_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$Phase2PageMetaDtoCWProxy {
  Phase2PageMetaDto total(num total);

  Phase2PageMetaDto page(num page);

  Phase2PageMetaDto pageSize(num pageSize);

  Phase2PageMetaDto pageCount(num pageCount);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `Phase2PageMetaDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// Phase2PageMetaDto(...).copyWith(id: 12, name: "My name")
  /// ````
  Phase2PageMetaDto call({num total, num page, num pageSize, num pageCount});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPhase2PageMetaDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPhase2PageMetaDto.copyWith.fieldName(...)`
class _$Phase2PageMetaDtoCWProxyImpl implements _$Phase2PageMetaDtoCWProxy {
  const _$Phase2PageMetaDtoCWProxyImpl(this._value);

  final Phase2PageMetaDto _value;

  @override
  Phase2PageMetaDto total(num total) => this(total: total);

  @override
  Phase2PageMetaDto page(num page) => this(page: page);

  @override
  Phase2PageMetaDto pageSize(num pageSize) => this(pageSize: pageSize);

  @override
  Phase2PageMetaDto pageCount(num pageCount) => this(pageCount: pageCount);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `Phase2PageMetaDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// Phase2PageMetaDto(...).copyWith(id: 12, name: "My name")
  /// ````
  Phase2PageMetaDto call({
    Object? total = const $CopyWithPlaceholder(),
    Object? page = const $CopyWithPlaceholder(),
    Object? pageSize = const $CopyWithPlaceholder(),
    Object? pageCount = const $CopyWithPlaceholder(),
  }) {
    return Phase2PageMetaDto(
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

extension $Phase2PageMetaDtoCopyWith on Phase2PageMetaDto {
  /// Returns a callable class that can be used as follows: `instanceOfPhase2PageMetaDto.copyWith(...)` or like so:`instanceOfPhase2PageMetaDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$Phase2PageMetaDtoCWProxy get copyWith =>
      _$Phase2PageMetaDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Phase2PageMetaDto _$Phase2PageMetaDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Phase2PageMetaDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['total', 'page', 'pageSize', 'pageCount'],
      );
      final val = Phase2PageMetaDto(
        total: $checkedConvert('total', (v) => v as num),
        page: $checkedConvert('page', (v) => v as num),
        pageSize: $checkedConvert('pageSize', (v) => v as num),
        pageCount: $checkedConvert('pageCount', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$Phase2PageMetaDtoToJson(Phase2PageMetaDto instance) =>
    <String, dynamic>{
      'total': instance.total,
      'page': instance.page,
      'pageSize': instance.pageSize,
      'pageCount': instance.pageCount,
    };
