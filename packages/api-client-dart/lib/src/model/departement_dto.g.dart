// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'departement_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DepartementDtoCWProxy {
  DepartementDto id(String id);

  DepartementDto code(String code);

  DepartementDto name(String name);

  DepartementDto regionId(String regionId);

  DepartementDto regionName(String regionName);

  DepartementDto isActive(bool isActive);

  DepartementDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DepartementDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DepartementDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DepartementDto call({
    String id,
    String code,
    String name,
    String regionId,
    String regionName,
    bool isActive,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDepartementDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDepartementDto.copyWith.fieldName(...)`
class _$DepartementDtoCWProxyImpl implements _$DepartementDtoCWProxy {
  const _$DepartementDtoCWProxyImpl(this._value);

  final DepartementDto _value;

  @override
  DepartementDto id(String id) => this(id: id);

  @override
  DepartementDto code(String code) => this(code: code);

  @override
  DepartementDto name(String name) => this(name: name);

  @override
  DepartementDto regionId(String regionId) => this(regionId: regionId);

  @override
  DepartementDto regionName(String regionName) => this(regionName: regionName);

  @override
  DepartementDto isActive(bool isActive) => this(isActive: isActive);

  @override
  DepartementDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DepartementDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DepartementDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DepartementDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? regionId = const $CopyWithPlaceholder(),
    Object? regionName = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return DepartementDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
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
      regionName: regionName == const $CopyWithPlaceholder()
          ? _value.regionName
          // ignore: cast_nullable_to_non_nullable
          : regionName as String,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
    );
  }
}

extension $DepartementDtoCopyWith on DepartementDto {
  /// Returns a callable class that can be used as follows: `instanceOfDepartementDto.copyWith(...)` or like so:`instanceOfDepartementDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DepartementDtoCWProxy get copyWith => _$DepartementDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DepartementDto _$DepartementDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DepartementDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'code',
          'name',
          'regionId',
          'regionName',
          'isActive',
          'updatedAt',
        ],
      );
      final val = DepartementDto(
        id: $checkedConvert('id', (v) => v as String),
        code: $checkedConvert('code', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        regionId: $checkedConvert('regionId', (v) => v as String),
        regionName: $checkedConvert('regionName', (v) => v as String),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$DepartementDtoToJson(DepartementDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'code': instance.code,
      'name': instance.name,
      'regionId': instance.regionId,
      'regionName': instance.regionName,
      'isActive': instance.isActive,
      'updatedAt': instance.updatedAt.toIso8601String(),
    };
