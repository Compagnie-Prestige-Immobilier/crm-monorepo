// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_profession_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateProfessionDtoCWProxy {
  CreateProfessionDto code(String code);

  CreateProfessionDto label(String label);

  CreateProfessionDto isTeaching(bool? isTeaching);

  CreateProfessionDto position(num? position);

  CreateProfessionDto isActive(bool? isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateProfessionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateProfessionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateProfessionDto call({
    String code,
    String label,
    bool? isTeaching,
    num? position,
    bool? isActive,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateProfessionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateProfessionDto.copyWith.fieldName(...)`
class _$CreateProfessionDtoCWProxyImpl implements _$CreateProfessionDtoCWProxy {
  const _$CreateProfessionDtoCWProxyImpl(this._value);

  final CreateProfessionDto _value;

  @override
  CreateProfessionDto code(String code) => this(code: code);

  @override
  CreateProfessionDto label(String label) => this(label: label);

  @override
  CreateProfessionDto isTeaching(bool? isTeaching) =>
      this(isTeaching: isTeaching);

  @override
  CreateProfessionDto position(num? position) => this(position: position);

  @override
  CreateProfessionDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateProfessionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateProfessionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateProfessionDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? isTeaching = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return CreateProfessionDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
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

extension $CreateProfessionDtoCopyWith on CreateProfessionDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateProfessionDto.copyWith(...)` or like so:`instanceOfCreateProfessionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateProfessionDtoCWProxy get copyWith =>
      _$CreateProfessionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateProfessionDto _$CreateProfessionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CreateProfessionDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['code', 'label']);
      final val = CreateProfessionDto(
        code: $checkedConvert('code', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        isTeaching: $checkedConvert('isTeaching', (v) => v as bool? ?? false),
        position: $checkedConvert('position', (v) => v as num?),
        isActive: $checkedConvert('isActive', (v) => v as bool? ?? true),
      );
      return val;
    });

Map<String, dynamic> _$CreateProfessionDtoToJson(
  CreateProfessionDto instance,
) => <String, dynamic>{
  'code': instance.code,
  'label': instance.label,
  if (instance.isTeaching case final value?) 'isTeaching': value,
  if (instance.position case final value?) 'position': value,
  if (instance.isActive case final value?) 'isActive': value,
};
