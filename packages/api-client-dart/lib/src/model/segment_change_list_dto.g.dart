// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'segment_change_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SegmentChangeListDtoCWProxy {
  SegmentChangeListDto items(List<SegmentChangeDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentChangeListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentChangeListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentChangeListDto call({List<SegmentChangeDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSegmentChangeListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSegmentChangeListDto.copyWith.fieldName(...)`
class _$SegmentChangeListDtoCWProxyImpl
    implements _$SegmentChangeListDtoCWProxy {
  const _$SegmentChangeListDtoCWProxyImpl(this._value);

  final SegmentChangeListDto _value;

  @override
  SegmentChangeListDto items(List<SegmentChangeDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentChangeListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentChangeListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentChangeListDto call({Object? items = const $CopyWithPlaceholder()}) {
    return SegmentChangeListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<SegmentChangeDto>,
    );
  }
}

extension $SegmentChangeListDtoCopyWith on SegmentChangeListDto {
  /// Returns a callable class that can be used as follows: `instanceOfSegmentChangeListDto.copyWith(...)` or like so:`instanceOfSegmentChangeListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SegmentChangeListDtoCWProxy get copyWith =>
      _$SegmentChangeListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SegmentChangeListDto _$SegmentChangeListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SegmentChangeListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = SegmentChangeListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => SegmentChangeDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$SegmentChangeListDtoToJson(
  SegmentChangeListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
