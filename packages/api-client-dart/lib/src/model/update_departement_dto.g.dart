// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_departement_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateDepartementDtoCWProxy {
  UpdateDepartementDto code(String? code);

  UpdateDepartementDto name(String? name);

  UpdateDepartementDto regionId(String? regionId);

  UpdateDepartementDto isActive(bool? isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateDepartementDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateDepartementDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateDepartementDto call({
    String? code,
    String? name,
    String? regionId,
    bool? isActive,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateDepartementDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateDepartementDto.copyWith.fieldName(...)`
class _$UpdateDepartementDtoCWProxyImpl
    implements _$UpdateDepartementDtoCWProxy {
  const _$UpdateDepartementDtoCWProxyImpl(this._value);

  final UpdateDepartementDto _value;

  @override
  UpdateDepartementDto code(String? code) => this(code: code);

  @override
  UpdateDepartementDto name(String? name) => this(name: name);

  @override
  UpdateDepartementDto regionId(String? regionId) => this(regionId: regionId);

  @override
  UpdateDepartementDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateDepartementDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateDepartementDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateDepartementDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? regionId = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return UpdateDepartementDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String?,
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String?,
      regionId: regionId == const $CopyWithPlaceholder()
          ? _value.regionId
          // ignore: cast_nullable_to_non_nullable
          : regionId as String?,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool?,
    );
  }
}

extension $UpdateDepartementDtoCopyWith on UpdateDepartementDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateDepartementDto.copyWith(...)` or like so:`instanceOfUpdateDepartementDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateDepartementDtoCWProxy get copyWith =>
      _$UpdateDepartementDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateDepartementDto _$UpdateDepartementDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateDepartementDto', json, ($checkedConvert) {
  final val = UpdateDepartementDto(
    code: $checkedConvert('code', (v) => v as String?),
    name: $checkedConvert('name', (v) => v as String?),
    regionId: $checkedConvert('regionId', (v) => v as String?),
    isActive: $checkedConvert('isActive', (v) => v as bool? ?? true),
  );
  return val;
});

Map<String, dynamic> _$UpdateDepartementDtoToJson(
  UpdateDepartementDto instance,
) => <String, dynamic>{
  if (instance.code case final value?) 'code': value,
  if (instance.name case final value?) 'name': value,
  if (instance.regionId case final value?) 'regionId': value,
  if (instance.isActive case final value?) 'isActive': value,
};
