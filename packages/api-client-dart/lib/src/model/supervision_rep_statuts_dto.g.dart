// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supervision_rep_statuts_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SupervisionRepStatutsDtoCWProxy {
  SupervisionRepStatutsDto total(num total);

  SupervisionRepStatutsDto items(List<SupervisionRepStatutDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionRepStatutsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionRepStatutsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionRepStatutsDto call({
    num total,
    List<SupervisionRepStatutDto> items,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSupervisionRepStatutsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSupervisionRepStatutsDto.copyWith.fieldName(...)`
class _$SupervisionRepStatutsDtoCWProxyImpl
    implements _$SupervisionRepStatutsDtoCWProxy {
  const _$SupervisionRepStatutsDtoCWProxyImpl(this._value);

  final SupervisionRepStatutsDto _value;

  @override
  SupervisionRepStatutsDto total(num total) => this(total: total);

  @override
  SupervisionRepStatutsDto items(List<SupervisionRepStatutDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionRepStatutsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionRepStatutsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionRepStatutsDto call({
    Object? total = const $CopyWithPlaceholder(),
    Object? items = const $CopyWithPlaceholder(),
  }) {
    return SupervisionRepStatutsDto(
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<SupervisionRepStatutDto>,
    );
  }
}

extension $SupervisionRepStatutsDtoCopyWith on SupervisionRepStatutsDto {
  /// Returns a callable class that can be used as follows: `instanceOfSupervisionRepStatutsDto.copyWith(...)` or like so:`instanceOfSupervisionRepStatutsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SupervisionRepStatutsDtoCWProxy get copyWith =>
      _$SupervisionRepStatutsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupervisionRepStatutsDto _$SupervisionRepStatutsDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SupervisionRepStatutsDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['total', 'items']);
  final val = SupervisionRepStatutsDto(
    total: $checkedConvert('total', (v) => v as num),
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) => SupervisionRepStatutDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$SupervisionRepStatutsDtoToJson(
  SupervisionRepStatutsDto instance,
) => <String, dynamic>{
  'total': instance.total,
  'items': instance.items.map((e) => e.toJson()).toList(),
};
