// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_income_band_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateIncomeBandDtoCWProxy {
  UpdateIncomeBandDto code(String? code);

  UpdateIncomeBandDto label(String? label);

  UpdateIncomeBandDto minXof(num? minXof);

  UpdateIncomeBandDto maxXof(num? maxXof);

  UpdateIncomeBandDto position(num? position);

  UpdateIncomeBandDto isActive(bool? isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateIncomeBandDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateIncomeBandDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateIncomeBandDto call({
    String? code,
    String? label,
    num? minXof,
    num? maxXof,
    num? position,
    bool? isActive,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateIncomeBandDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateIncomeBandDto.copyWith.fieldName(...)`
class _$UpdateIncomeBandDtoCWProxyImpl implements _$UpdateIncomeBandDtoCWProxy {
  const _$UpdateIncomeBandDtoCWProxyImpl(this._value);

  final UpdateIncomeBandDto _value;

  @override
  UpdateIncomeBandDto code(String? code) => this(code: code);

  @override
  UpdateIncomeBandDto label(String? label) => this(label: label);

  @override
  UpdateIncomeBandDto minXof(num? minXof) => this(minXof: minXof);

  @override
  UpdateIncomeBandDto maxXof(num? maxXof) => this(maxXof: maxXof);

  @override
  UpdateIncomeBandDto position(num? position) => this(position: position);

  @override
  UpdateIncomeBandDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateIncomeBandDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateIncomeBandDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateIncomeBandDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? minXof = const $CopyWithPlaceholder(),
    Object? maxXof = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return UpdateIncomeBandDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String?,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String?,
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

extension $UpdateIncomeBandDtoCopyWith on UpdateIncomeBandDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateIncomeBandDto.copyWith(...)` or like so:`instanceOfUpdateIncomeBandDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateIncomeBandDtoCWProxy get copyWith =>
      _$UpdateIncomeBandDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateIncomeBandDto _$UpdateIncomeBandDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UpdateIncomeBandDto', json, ($checkedConvert) {
      final val = UpdateIncomeBandDto(
        code: $checkedConvert('code', (v) => v as String?),
        label: $checkedConvert('label', (v) => v as String?),
        minXof: $checkedConvert('minXof', (v) => v as num?),
        maxXof: $checkedConvert('maxXof', (v) => v as num?),
        position: $checkedConvert('position', (v) => v as num?),
        isActive: $checkedConvert('isActive', (v) => v as bool? ?? true),
      );
      return val;
    });

Map<String, dynamic> _$UpdateIncomeBandDtoToJson(
  UpdateIncomeBandDto instance,
) => <String, dynamic>{
  if (instance.code case final value?) 'code': value,
  if (instance.label case final value?) 'label': value,
  if (instance.minXof case final value?) 'minXof': value,
  if (instance.maxXof case final value?) 'maxXof': value,
  if (instance.position case final value?) 'position': value,
  if (instance.isActive case final value?) 'isActive': value,
};
