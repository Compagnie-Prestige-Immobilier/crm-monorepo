// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'top_representant_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$TopRepresentantListDtoCWProxy {
  TopRepresentantListDto items(List<TopRepresentantDto> items);

  TopRepresentantListDto total(num total);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TopRepresentantListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TopRepresentantListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TopRepresentantListDto call({List<TopRepresentantDto> items, num total});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfTopRepresentantListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfTopRepresentantListDto.copyWith.fieldName(...)`
class _$TopRepresentantListDtoCWProxyImpl
    implements _$TopRepresentantListDtoCWProxy {
  const _$TopRepresentantListDtoCWProxyImpl(this._value);

  final TopRepresentantListDto _value;

  @override
  TopRepresentantListDto items(List<TopRepresentantDto> items) =>
      this(items: items);

  @override
  TopRepresentantListDto total(num total) => this(total: total);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TopRepresentantListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TopRepresentantListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TopRepresentantListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? total = const $CopyWithPlaceholder(),
  }) {
    return TopRepresentantListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<TopRepresentantDto>,
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
    );
  }
}

extension $TopRepresentantListDtoCopyWith on TopRepresentantListDto {
  /// Returns a callable class that can be used as follows: `instanceOfTopRepresentantListDto.copyWith(...)` or like so:`instanceOfTopRepresentantListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$TopRepresentantListDtoCWProxy get copyWith =>
      _$TopRepresentantListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TopRepresentantListDto _$TopRepresentantListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('TopRepresentantListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'total']);
  final val = TopRepresentantListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => TopRepresentantDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    total: $checkedConvert('total', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$TopRepresentantListDtoToJson(
  TopRepresentantListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'total': instance.total,
};
