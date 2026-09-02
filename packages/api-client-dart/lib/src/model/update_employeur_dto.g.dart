// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_employeur_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateEmployeurDtoCWProxy {
  UpdateEmployeurDto code(String? code);

  UpdateEmployeurDto label(String? label);

  UpdateEmployeurDto type(EmployeurType? type);

  UpdateEmployeurDto position(num? position);

  UpdateEmployeurDto isActive(bool? isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateEmployeurDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateEmployeurDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateEmployeurDto call({
    String? code,
    String? label,
    EmployeurType? type,
    num? position,
    bool? isActive,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateEmployeurDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateEmployeurDto.copyWith.fieldName(...)`
class _$UpdateEmployeurDtoCWProxyImpl implements _$UpdateEmployeurDtoCWProxy {
  const _$UpdateEmployeurDtoCWProxyImpl(this._value);

  final UpdateEmployeurDto _value;

  @override
  UpdateEmployeurDto code(String? code) => this(code: code);

  @override
  UpdateEmployeurDto label(String? label) => this(label: label);

  @override
  UpdateEmployeurDto type(EmployeurType? type) => this(type: type);

  @override
  UpdateEmployeurDto position(num? position) => this(position: position);

  @override
  UpdateEmployeurDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateEmployeurDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateEmployeurDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateEmployeurDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? type = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return UpdateEmployeurDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String?,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String?,
      type: type == const $CopyWithPlaceholder()
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as EmployeurType?,
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

extension $UpdateEmployeurDtoCopyWith on UpdateEmployeurDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateEmployeurDto.copyWith(...)` or like so:`instanceOfUpdateEmployeurDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateEmployeurDtoCWProxy get copyWith =>
      _$UpdateEmployeurDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateEmployeurDto _$UpdateEmployeurDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UpdateEmployeurDto', json, ($checkedConvert) {
      final val = UpdateEmployeurDto(
        code: $checkedConvert('code', (v) => v as String?),
        label: $checkedConvert('label', (v) => v as String?),
        type: $checkedConvert(
          'type',
          (v) => $enumDecodeNullable(
            _$EmployeurTypeEnumMap,
            v,
            unknownValue: EmployeurType.unknownDefaultOpenApi,
          ),
        ),
        position: $checkedConvert('position', (v) => v as num?),
        isActive: $checkedConvert('isActive', (v) => v as bool? ?? true),
      );
      return val;
    });

Map<String, dynamic> _$UpdateEmployeurDtoToJson(
  UpdateEmployeurDto instance,
) => <String, dynamic>{
  if (instance.code case final value?) 'code': value,
  if (instance.label case final value?) 'label': value,
  if (_$EmployeurTypeEnumMap[instance.type] case final value?) 'type': value,
  if (instance.position case final value?) 'position': value,
  if (instance.isActive case final value?) 'isActive': value,
};

const _$EmployeurTypeEnumMap = {
  EmployeurType.MINISTERE: 'MINISTERE',
  EmployeurType.ENTREPRISE: 'ENTREPRISE',
  EmployeurType.AUTRE: 'AUTRE',
  EmployeurType.unknownDefaultOpenApi: 'unknown_default_open_api',
};
