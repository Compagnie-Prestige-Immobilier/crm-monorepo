// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'named_count_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$NamedCountListDtoCWProxy {
  NamedCountListDto items(List<NamedCountDto> items);

  NamedCountListDto total(num total);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NamedCountListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NamedCountListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NamedCountListDto call({List<NamedCountDto> items, num total});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfNamedCountListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfNamedCountListDto.copyWith.fieldName(...)`
class _$NamedCountListDtoCWProxyImpl implements _$NamedCountListDtoCWProxy {
  const _$NamedCountListDtoCWProxyImpl(this._value);

  final NamedCountListDto _value;

  @override
  NamedCountListDto items(List<NamedCountDto> items) => this(items: items);

  @override
  NamedCountListDto total(num total) => this(total: total);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NamedCountListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NamedCountListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NamedCountListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? total = const $CopyWithPlaceholder(),
  }) {
    return NamedCountListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<NamedCountDto>,
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
    );
  }
}

extension $NamedCountListDtoCopyWith on NamedCountListDto {
  /// Returns a callable class that can be used as follows: `instanceOfNamedCountListDto.copyWith(...)` or like so:`instanceOfNamedCountListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$NamedCountListDtoCWProxy get copyWith =>
      _$NamedCountListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NamedCountListDto _$NamedCountListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('NamedCountListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'total']);
      final val = NamedCountListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => NamedCountDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        total: $checkedConvert('total', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$NamedCountListDtoToJson(NamedCountListDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'total': instance.total,
    };
