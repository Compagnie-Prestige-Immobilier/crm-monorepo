// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_employeur_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateEmployeurDtoCWProxy {
  CreateEmployeurDto code(String code);

  CreateEmployeurDto label(String label);

  CreateEmployeurDto type(EmployeurType type);

  CreateEmployeurDto position(num? position);

  CreateEmployeurDto isActive(bool? isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateEmployeurDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateEmployeurDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateEmployeurDto call({
    String code,
    String label,
    EmployeurType type,
    num? position,
    bool? isActive,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateEmployeurDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateEmployeurDto.copyWith.fieldName(...)`
class _$CreateEmployeurDtoCWProxyImpl implements _$CreateEmployeurDtoCWProxy {
  const _$CreateEmployeurDtoCWProxyImpl(this._value);

  final CreateEmployeurDto _value;

  @override
  CreateEmployeurDto code(String code) => this(code: code);

  @override
  CreateEmployeurDto label(String label) => this(label: label);

  @override
  CreateEmployeurDto type(EmployeurType type) => this(type: type);

  @override
  CreateEmployeurDto position(num? position) => this(position: position);

  @override
  CreateEmployeurDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateEmployeurDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateEmployeurDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateEmployeurDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? type = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return CreateEmployeurDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      type: type == const $CopyWithPlaceholder()
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as EmployeurType,
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

extension $CreateEmployeurDtoCopyWith on CreateEmployeurDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateEmployeurDto.copyWith(...)` or like so:`instanceOfCreateEmployeurDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateEmployeurDtoCWProxy get copyWith =>
      _$CreateEmployeurDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateEmployeurDto _$CreateEmployeurDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CreateEmployeurDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['code', 'label', 'type']);
      final val = CreateEmployeurDto(
        code: $checkedConvert('code', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        type: $checkedConvert(
          'type',
          (v) => $enumDecode(
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

Map<String, dynamic> _$CreateEmployeurDtoToJson(CreateEmployeurDto instance) =>
    <String, dynamic>{
      'code': instance.code,
      'label': instance.label,
      'type': _$EmployeurTypeEnumMap[instance.type]!,
      if (instance.position case final value?) 'position': value,
      if (instance.isActive case final value?) 'isActive': value,
    };

const _$EmployeurTypeEnumMap = {
  EmployeurType.MINISTERE: 'MINISTERE',
  EmployeurType.ENTREPRISE: 'ENTREPRISE',
  EmployeurType.AUTRE: 'AUTRE',
  EmployeurType.unknownDefaultOpenApi: 'unknown_default_open_api',
};
