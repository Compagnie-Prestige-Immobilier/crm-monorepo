// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'top_commercial_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$TopCommercialListDtoCWProxy {
  TopCommercialListDto items(List<TopCommercialDto> items);

  TopCommercialListDto total(num total);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TopCommercialListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TopCommercialListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TopCommercialListDto call({List<TopCommercialDto> items, num total});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfTopCommercialListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfTopCommercialListDto.copyWith.fieldName(...)`
class _$TopCommercialListDtoCWProxyImpl
    implements _$TopCommercialListDtoCWProxy {
  const _$TopCommercialListDtoCWProxyImpl(this._value);

  final TopCommercialListDto _value;

  @override
  TopCommercialListDto items(List<TopCommercialDto> items) =>
      this(items: items);

  @override
  TopCommercialListDto total(num total) => this(total: total);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TopCommercialListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TopCommercialListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TopCommercialListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? total = const $CopyWithPlaceholder(),
  }) {
    return TopCommercialListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<TopCommercialDto>,
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
    );
  }
}

extension $TopCommercialListDtoCopyWith on TopCommercialListDto {
  /// Returns a callable class that can be used as follows: `instanceOfTopCommercialListDto.copyWith(...)` or like so:`instanceOfTopCommercialListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$TopCommercialListDtoCWProxy get copyWith =>
      _$TopCommercialListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TopCommercialListDto _$TopCommercialListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('TopCommercialListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'total']);
  final val = TopCommercialListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => TopCommercialDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    total: $checkedConvert('total', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$TopCommercialListDtoToJson(
  TopCommercialListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'total': instance.total,
};
