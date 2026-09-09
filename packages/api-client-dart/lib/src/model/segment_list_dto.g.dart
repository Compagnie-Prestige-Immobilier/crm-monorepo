// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'segment_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SegmentListDtoCWProxy {
  SegmentListDto items(List<SegmentCountDto> items);

  SegmentListDto total(num total);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentListDto call({List<SegmentCountDto> items, num total});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSegmentListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSegmentListDto.copyWith.fieldName(...)`
class _$SegmentListDtoCWProxyImpl implements _$SegmentListDtoCWProxy {
  const _$SegmentListDtoCWProxyImpl(this._value);

  final SegmentListDto _value;

  @override
  SegmentListDto items(List<SegmentCountDto> items) => this(items: items);

  @override
  SegmentListDto total(num total) => this(total: total);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? total = const $CopyWithPlaceholder(),
  }) {
    return SegmentListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<SegmentCountDto>,
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
    );
  }
}

extension $SegmentListDtoCopyWith on SegmentListDto {
  /// Returns a callable class that can be used as follows: `instanceOfSegmentListDto.copyWith(...)` or like so:`instanceOfSegmentListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SegmentListDtoCWProxy get copyWith => _$SegmentListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SegmentListDto _$SegmentListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SegmentListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'total']);
      final val = SegmentListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => SegmentCountDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        total: $checkedConvert('total', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$SegmentListDtoToJson(SegmentListDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'total': instance.total,
    };
