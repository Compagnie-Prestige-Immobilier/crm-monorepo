// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_departement_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateDepartementDtoCWProxy {
  CreateDepartementDto code(String code);

  CreateDepartementDto name(String name);

  CreateDepartementDto regionId(String regionId);

  CreateDepartementDto isActive(bool? isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateDepartementDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateDepartementDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateDepartementDto call({
    String code,
    String name,
    String regionId,
    bool? isActive,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateDepartementDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateDepartementDto.copyWith.fieldName(...)`
class _$CreateDepartementDtoCWProxyImpl
    implements _$CreateDepartementDtoCWProxy {
  const _$CreateDepartementDtoCWProxyImpl(this._value);

  final CreateDepartementDto _value;

  @override
  CreateDepartementDto code(String code) => this(code: code);

  @override
  CreateDepartementDto name(String name) => this(name: name);

  @override
  CreateDepartementDto regionId(String regionId) => this(regionId: regionId);

  @override
  CreateDepartementDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateDepartementDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateDepartementDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateDepartementDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? regionId = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return CreateDepartementDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      regionId: regionId == const $CopyWithPlaceholder()
          ? _value.regionId
          // ignore: cast_nullable_to_non_nullable
          : regionId as String,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool?,
    );
  }
}

extension $CreateDepartementDtoCopyWith on CreateDepartementDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateDepartementDto.copyWith(...)` or like so:`instanceOfCreateDepartementDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateDepartementDtoCWProxy get copyWith =>
      _$CreateDepartementDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateDepartementDto _$CreateDepartementDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateDepartementDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['code', 'name', 'regionId']);
  final val = CreateDepartementDto(
    code: $checkedConvert('code', (v) => v as String),
    name: $checkedConvert('name', (v) => v as String),
    regionId: $checkedConvert('regionId', (v) => v as String),
    isActive: $checkedConvert('isActive', (v) => v as bool? ?? true),
  );
  return val;
});

Map<String, dynamic> _$CreateDepartementDtoToJson(
  CreateDepartementDto instance,
) => <String, dynamic>{
  'code': instance.code,
  'name': instance.name,
  'regionId': instance.regionId,
  if (instance.isActive case final value?) 'isActive': value,
};
