// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_income_band_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateIncomeBandDtoCWProxy {
  CreateIncomeBandDto code(String code);

  CreateIncomeBandDto label(String label);

  CreateIncomeBandDto minXof(num? minXof);

  CreateIncomeBandDto maxXof(num? maxXof);

  CreateIncomeBandDto position(num? position);

  CreateIncomeBandDto isActive(bool? isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateIncomeBandDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateIncomeBandDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateIncomeBandDto call({
    String code,
    String label,
    num? minXof,
    num? maxXof,
    num? position,
    bool? isActive,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateIncomeBandDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateIncomeBandDto.copyWith.fieldName(...)`
class _$CreateIncomeBandDtoCWProxyImpl implements _$CreateIncomeBandDtoCWProxy {
  const _$CreateIncomeBandDtoCWProxyImpl(this._value);

  final CreateIncomeBandDto _value;

  @override
  CreateIncomeBandDto code(String code) => this(code: code);

  @override
  CreateIncomeBandDto label(String label) => this(label: label);

  @override
  CreateIncomeBandDto minXof(num? minXof) => this(minXof: minXof);

  @override
  CreateIncomeBandDto maxXof(num? maxXof) => this(maxXof: maxXof);

  @override
  CreateIncomeBandDto position(num? position) => this(position: position);

  @override
  CreateIncomeBandDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateIncomeBandDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateIncomeBandDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateIncomeBandDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? minXof = const $CopyWithPlaceholder(),
    Object? maxXof = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return CreateIncomeBandDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      minXof: minXof == const $CopyWithPlaceholder()
          ? _value.minXof
          // ignore: cast_nullable_to_non_nullable
          : minXof as num?,
      maxXof: maxXof == const $CopyWithPlaceholder()
          ? _value.maxXof
          // ignore: cast_nullable_to_non_nullable
          : maxXof as num?,
      position: position == const $CopyWithPlaceholder()
          ? _value.position
          // ignore: cast_nullable_to_non_nullable
          : position as num?,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool?,
    );
  }
}

extension $CreateIncomeBandDtoCopyWith on CreateIncomeBandDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateIncomeBandDto.copyWith(...)` or like so:`instanceOfCreateIncomeBandDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateIncomeBandDtoCWProxy get copyWith =>
      _$CreateIncomeBandDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateIncomeBandDto _$CreateIncomeBandDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CreateIncomeBandDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['code', 'label']);
      final val = CreateIncomeBandDto(
        code: $checkedConvert('code', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        minXof: $checkedConvert('minXof', (v) => v as num?),
        maxXof: $checkedConvert('maxXof', (v) => v as num?),
        position: $checkedConvert('position', (v) => v as num?),
        isActive: $checkedConvert('isActive', (v) => v as bool? ?? true),
      );
      return val;
    });

Map<String, dynamic> _$CreateIncomeBandDtoToJson(
  CreateIncomeBandDto instance,
) => <String, dynamic>{
  'code': instance.code,
  'label': instance.label,
  if (instance.minXof case final value?) 'minXof': value,
  if (instance.maxXof case final value?) 'maxXof': value,
  if (instance.position case final value?) 'position': value,
  if (instance.isActive case final value?) 'isActive': value,
};
