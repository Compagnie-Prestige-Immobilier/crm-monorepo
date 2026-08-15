// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'origin_breakdown_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$OriginBreakdownDtoCWProxy {
  OriginBreakdownDto items(List<OriginCountDto> items);

  OriginBreakdownDto byLabel(List<OriginLabelCountDto> byLabel);

  OriginBreakdownDto total(num total);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OriginBreakdownDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OriginBreakdownDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OriginBreakdownDto call({
    List<OriginCountDto> items,
    List<OriginLabelCountDto> byLabel,
    num total,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfOriginBreakdownDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfOriginBreakdownDto.copyWith.fieldName(...)`
class _$OriginBreakdownDtoCWProxyImpl implements _$OriginBreakdownDtoCWProxy {
  const _$OriginBreakdownDtoCWProxyImpl(this._value);

  final OriginBreakdownDto _value;

  @override
  OriginBreakdownDto items(List<OriginCountDto> items) => this(items: items);

  @override
  OriginBreakdownDto byLabel(List<OriginLabelCountDto> byLabel) =>
      this(byLabel: byLabel);

  @override
  OriginBreakdownDto total(num total) => this(total: total);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OriginBreakdownDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OriginBreakdownDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OriginBreakdownDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? byLabel = const $CopyWithPlaceholder(),
    Object? total = const $CopyWithPlaceholder(),
  }) {
    return OriginBreakdownDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<OriginCountDto>,
      byLabel: byLabel == const $CopyWithPlaceholder()
          ? _value.byLabel
          // ignore: cast_nullable_to_non_nullable
          : byLabel as List<OriginLabelCountDto>,
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
    );
  }
}

extension $OriginBreakdownDtoCopyWith on OriginBreakdownDto {
  /// Returns a callable class that can be used as follows: `instanceOfOriginBreakdownDto.copyWith(...)` or like so:`instanceOfOriginBreakdownDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$OriginBreakdownDtoCWProxy get copyWith =>
      _$OriginBreakdownDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OriginBreakdownDto _$OriginBreakdownDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('OriginBreakdownDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'byLabel', 'total']);
      final val = OriginBreakdownDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => OriginCountDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        byLabel: $checkedConvert(
          'byLabel',
          (v) => (v as List<dynamic>)
              .map(
                (e) => OriginLabelCountDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
        total: $checkedConvert('total', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$OriginBreakdownDtoToJson(OriginBreakdownDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'byLabel': instance.byLabel.map((e) => e.toJson()).toList(),
      'total': instance.total,
    };
