// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_profession_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateProfessionDtoCWProxy {
  UpdateProfessionDto code(String? code);

  UpdateProfessionDto label(String? label);

  UpdateProfessionDto isTeaching(bool? isTeaching);

  UpdateProfessionDto position(num? position);

  UpdateProfessionDto isActive(bool? isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateProfessionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateProfessionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateProfessionDto call({
    String? code,
    String? label,
    bool? isTeaching,
    num? position,
    bool? isActive,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateProfessionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateProfessionDto.copyWith.fieldName(...)`
class _$UpdateProfessionDtoCWProxyImpl implements _$UpdateProfessionDtoCWProxy {
  const _$UpdateProfessionDtoCWProxyImpl(this._value);

  final UpdateProfessionDto _value;

  @override
  UpdateProfessionDto code(String? code) => this(code: code);

  @override
  UpdateProfessionDto label(String? label) => this(label: label);

  @override
  UpdateProfessionDto isTeaching(bool? isTeaching) =>
      this(isTeaching: isTeaching);

  @override
  UpdateProfessionDto position(num? position) => this(position: position);

  @override
  UpdateProfessionDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateProfessionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateProfessionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateProfessionDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? isTeaching = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return UpdateProfessionDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String?,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String?,
      isTeaching: isTeaching == const $CopyWithPlaceholder()
          ? _value.isTeaching
          // ignore: cast_nullable_to_non_nullable
          : isTeaching as bool?,
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

extension $UpdateProfessionDtoCopyWith on UpdateProfessionDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateProfessionDto.copyWith(...)` or like so:`instanceOfUpdateProfessionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateProfessionDtoCWProxy get copyWith =>
      _$UpdateProfessionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateProfessionDto _$UpdateProfessionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UpdateProfessionDto', json, ($checkedConvert) {
      final val = UpdateProfessionDto(
        code: $checkedConvert('code', (v) => v as String?),
        label: $checkedConvert('label', (v) => v as String?),
        isTeaching: $checkedConvert('isTeaching', (v) => v as bool? ?? false),
        position: $checkedConvert('position', (v) => v as num?),
        isActive: $checkedConvert('isActive', (v) => v as bool? ?? true),
      );
      return val;
    });

Map<String, dynamic> _$UpdateProfessionDtoToJson(
  UpdateProfessionDto instance,
) => <String, dynamic>{
  if (instance.code case final value?) 'code': value,
  if (instance.label case final value?) 'label': value,
  if (instance.isTeaching case final value?) 'isTeaching': value,
  if (instance.position case final value?) 'position': value,
  if (instance.isActive case final value?) 'isActive': value,
};
