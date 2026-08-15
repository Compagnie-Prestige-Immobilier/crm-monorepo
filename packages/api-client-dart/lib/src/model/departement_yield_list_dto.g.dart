// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'departement_yield_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DepartementYieldListDtoCWProxy {
  DepartementYieldListDto items(List<DepartementYieldDto> items);

  DepartementYieldListDto total(num total);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DepartementYieldListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DepartementYieldListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DepartementYieldListDto call({List<DepartementYieldDto> items, num total});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDepartementYieldListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDepartementYieldListDto.copyWith.fieldName(...)`
class _$DepartementYieldListDtoCWProxyImpl
    implements _$DepartementYieldListDtoCWProxy {
  const _$DepartementYieldListDtoCWProxyImpl(this._value);

  final DepartementYieldListDto _value;

  @override
  DepartementYieldListDto items(List<DepartementYieldDto> items) =>
      this(items: items);

  @override
  DepartementYieldListDto total(num total) => this(total: total);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DepartementYieldListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DepartementYieldListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DepartementYieldListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? total = const $CopyWithPlaceholder(),
  }) {
    return DepartementYieldListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<DepartementYieldDto>,
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
    );
  }
}

extension $DepartementYieldListDtoCopyWith on DepartementYieldListDto {
  /// Returns a callable class that can be used as follows: `instanceOfDepartementYieldListDto.copyWith(...)` or like so:`instanceOfDepartementYieldListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DepartementYieldListDtoCWProxy get copyWith =>
      _$DepartementYieldListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DepartementYieldListDto _$DepartementYieldListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('DepartementYieldListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'total']);
  final val = DepartementYieldListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => DepartementYieldDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    total: $checkedConvert('total', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$DepartementYieldListDtoToJson(
  DepartementYieldListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'total': instance.total,
};
