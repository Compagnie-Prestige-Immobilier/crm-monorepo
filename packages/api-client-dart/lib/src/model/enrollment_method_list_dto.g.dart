// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'enrollment_method_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$EnrollmentMethodListDtoCWProxy {
  EnrollmentMethodListDto items(List<EnrollmentMethodCountDto> items);

  EnrollmentMethodListDto total(num total);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `EnrollmentMethodListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// EnrollmentMethodListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  EnrollmentMethodListDto call({
    List<EnrollmentMethodCountDto> items,
    num total,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfEnrollmentMethodListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfEnrollmentMethodListDto.copyWith.fieldName(...)`
class _$EnrollmentMethodListDtoCWProxyImpl
    implements _$EnrollmentMethodListDtoCWProxy {
  const _$EnrollmentMethodListDtoCWProxyImpl(this._value);

  final EnrollmentMethodListDto _value;

  @override
  EnrollmentMethodListDto items(List<EnrollmentMethodCountDto> items) =>
      this(items: items);

  @override
  EnrollmentMethodListDto total(num total) => this(total: total);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `EnrollmentMethodListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// EnrollmentMethodListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  EnrollmentMethodListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? total = const $CopyWithPlaceholder(),
  }) {
    return EnrollmentMethodListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<EnrollmentMethodCountDto>,
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
    );
  }
}

extension $EnrollmentMethodListDtoCopyWith on EnrollmentMethodListDto {
  /// Returns a callable class that can be used as follows: `instanceOfEnrollmentMethodListDto.copyWith(...)` or like so:`instanceOfEnrollmentMethodListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$EnrollmentMethodListDtoCWProxy get copyWith =>
      _$EnrollmentMethodListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

EnrollmentMethodListDto _$EnrollmentMethodListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('EnrollmentMethodListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'total']);
  final val = EnrollmentMethodListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) => EnrollmentMethodCountDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
    total: $checkedConvert('total', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$EnrollmentMethodListDtoToJson(
  EnrollmentMethodListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'total': instance.total,
};
