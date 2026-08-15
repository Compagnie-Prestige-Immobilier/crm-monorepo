// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weekly_cohort_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$WeeklyCohortListDtoCWProxy {
  WeeklyCohortListDto items(List<WeeklyCohortDto> items);

  WeeklyCohortListDto total(num total);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `WeeklyCohortListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// WeeklyCohortListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  WeeklyCohortListDto call({List<WeeklyCohortDto> items, num total});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfWeeklyCohortListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfWeeklyCohortListDto.copyWith.fieldName(...)`
class _$WeeklyCohortListDtoCWProxyImpl implements _$WeeklyCohortListDtoCWProxy {
  const _$WeeklyCohortListDtoCWProxyImpl(this._value);

  final WeeklyCohortListDto _value;

  @override
  WeeklyCohortListDto items(List<WeeklyCohortDto> items) => this(items: items);

  @override
  WeeklyCohortListDto total(num total) => this(total: total);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `WeeklyCohortListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// WeeklyCohortListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  WeeklyCohortListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? total = const $CopyWithPlaceholder(),
  }) {
    return WeeklyCohortListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<WeeklyCohortDto>,
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
    );
  }
}

extension $WeeklyCohortListDtoCopyWith on WeeklyCohortListDto {
  /// Returns a callable class that can be used as follows: `instanceOfWeeklyCohortListDto.copyWith(...)` or like so:`instanceOfWeeklyCohortListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$WeeklyCohortListDtoCWProxy get copyWith =>
      _$WeeklyCohortListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

WeeklyCohortListDto _$WeeklyCohortListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('WeeklyCohortListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'total']);
      final val = WeeklyCohortListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => WeeklyCohortDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        total: $checkedConvert('total', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$WeeklyCohortListDtoToJson(
  WeeklyCohortListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'total': instance.total,
};
