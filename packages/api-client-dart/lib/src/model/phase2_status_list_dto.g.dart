// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'phase2_status_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$Phase2StatusListDtoCWProxy {
  Phase2StatusListDto items(List<Phase2StatusCountDto> items);

  Phase2StatusListDto total(num total);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `Phase2StatusListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// Phase2StatusListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  Phase2StatusListDto call({List<Phase2StatusCountDto> items, num total});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPhase2StatusListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPhase2StatusListDto.copyWith.fieldName(...)`
class _$Phase2StatusListDtoCWProxyImpl implements _$Phase2StatusListDtoCWProxy {
  const _$Phase2StatusListDtoCWProxyImpl(this._value);

  final Phase2StatusListDto _value;

  @override
  Phase2StatusListDto items(List<Phase2StatusCountDto> items) =>
      this(items: items);

  @override
  Phase2StatusListDto total(num total) => this(total: total);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `Phase2StatusListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// Phase2StatusListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  Phase2StatusListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? total = const $CopyWithPlaceholder(),
  }) {
    return Phase2StatusListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<Phase2StatusCountDto>,
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
    );
  }
}

extension $Phase2StatusListDtoCopyWith on Phase2StatusListDto {
  /// Returns a callable class that can be used as follows: `instanceOfPhase2StatusListDto.copyWith(...)` or like so:`instanceOfPhase2StatusListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$Phase2StatusListDtoCWProxy get copyWith =>
      _$Phase2StatusListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Phase2StatusListDto _$Phase2StatusListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Phase2StatusListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'total']);
      final val = Phase2StatusListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map(
                (e) => Phase2StatusCountDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
        total: $checkedConvert('total', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$Phase2StatusListDtoToJson(
  Phase2StatusListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'total': instance.total,
};
