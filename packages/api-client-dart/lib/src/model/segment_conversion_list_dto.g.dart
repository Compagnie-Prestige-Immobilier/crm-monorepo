// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'segment_conversion_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SegmentConversionListDtoCWProxy {
  SegmentConversionListDto items(List<SegmentConversionDto> items);

  SegmentConversionListDto meta(PageMetaDto meta);

  SegmentConversionListDto byOriginSegment(
    List<SegmentConversionOriginDto> byOriginSegment,
  );

  SegmentConversionListDto byAuthor(List<SegmentConversionAuthorDto> byAuthor);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentConversionListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentConversionListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentConversionListDto call({
    List<SegmentConversionDto> items,
    PageMetaDto meta,
    List<SegmentConversionOriginDto> byOriginSegment,
    List<SegmentConversionAuthorDto> byAuthor,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSegmentConversionListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSegmentConversionListDto.copyWith.fieldName(...)`
class _$SegmentConversionListDtoCWProxyImpl
    implements _$SegmentConversionListDtoCWProxy {
  const _$SegmentConversionListDtoCWProxyImpl(this._value);

  final SegmentConversionListDto _value;

  @override
  SegmentConversionListDto items(List<SegmentConversionDto> items) =>
      this(items: items);

  @override
  SegmentConversionListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  SegmentConversionListDto byOriginSegment(
    List<SegmentConversionOriginDto> byOriginSegment,
  ) => this(byOriginSegment: byOriginSegment);

  @override
  SegmentConversionListDto byAuthor(
    List<SegmentConversionAuthorDto> byAuthor,
  ) => this(byAuthor: byAuthor);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentConversionListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentConversionListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentConversionListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
    Object? byOriginSegment = const $CopyWithPlaceholder(),
    Object? byAuthor = const $CopyWithPlaceholder(),
  }) {
    return SegmentConversionListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<SegmentConversionDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
      byOriginSegment: byOriginSegment == const $CopyWithPlaceholder()
          ? _value.byOriginSegment
          // ignore: cast_nullable_to_non_nullable
          : byOriginSegment as List<SegmentConversionOriginDto>,
      byAuthor: byAuthor == const $CopyWithPlaceholder()
          ? _value.byAuthor
          // ignore: cast_nullable_to_non_nullable
          : byAuthor as List<SegmentConversionAuthorDto>,
    );
  }
}

extension $SegmentConversionListDtoCopyWith on SegmentConversionListDto {
  /// Returns a callable class that can be used as follows: `instanceOfSegmentConversionListDto.copyWith(...)` or like so:`instanceOfSegmentConversionListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SegmentConversionListDtoCWProxy get copyWith =>
      _$SegmentConversionListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SegmentConversionListDto _$SegmentConversionListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SegmentConversionListDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['items', 'meta', 'byOriginSegment', 'byAuthor'],
  );
  final val = SegmentConversionListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => SegmentConversionDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    meta: $checkedConvert(
      'meta',
      (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
    ),
    byOriginSegment: $checkedConvert(
      'byOriginSegment',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                SegmentConversionOriginDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
    byAuthor: $checkedConvert(
      'byAuthor',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                SegmentConversionAuthorDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$SegmentConversionListDtoToJson(
  SegmentConversionListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'meta': instance.meta.toJson(),
  'byOriginSegment': instance.byOriginSegment.map((e) => e.toJson()).toList(),
  'byAuthor': instance.byAuthor.map((e) => e.toJson()).toList(),
};
