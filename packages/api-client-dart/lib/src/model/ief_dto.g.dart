// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ief_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$IefDtoCWProxy {
  IefDto id(String id);

  IefDto code(String code);

  IefDto name(String name);

  IefDto departementId(String departementId);

  IefDto departementName(String departementName);

  IefDto regionName(String regionName);

  IefDto isActive(bool isActive);

  IefDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `IefDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// IefDto(...).copyWith(id: 12, name: "My name")
  /// ````
  IefDto call({
    String id,
    String code,
    String name,
    String departementId,
    String departementName,
    String regionName,
    bool isActive,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfIefDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfIefDto.copyWith.fieldName(...)`
class _$IefDtoCWProxyImpl implements _$IefDtoCWProxy {
  const _$IefDtoCWProxyImpl(this._value);

  final IefDto _value;

  @override
  IefDto id(String id) => this(id: id);

  @override
  IefDto code(String code) => this(code: code);

  @override
  IefDto name(String name) => this(name: name);

  @override
  IefDto departementId(String departementId) =>
      this(departementId: departementId);

  @override
  IefDto departementName(String departementName) =>
      this(departementName: departementName);

  @override
  IefDto regionName(String regionName) => this(regionName: regionName);

  @override
  IefDto isActive(bool isActive) => this(isActive: isActive);

  @override
  IefDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `IefDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// IefDto(...).copyWith(id: 12, name: "My name")
  /// ````
  IefDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? departementId = const $CopyWithPlaceholder(),
    Object? departementName = const $CopyWithPlaceholder(),
    Object? regionName = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return IefDto(
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
      departementId: departementId == const $CopyWithPlaceholder()
          ? _value.departementId
          // ignore: cast_nullable_to_non_nullable
          : departementId as String,
      departementName: departementName == const $CopyWithPlaceholder()
          ? _value.departementName
          // ignore: cast_nullable_to_non_nullable
          : departementName as String,
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

extension $IefDtoCopyWith on IefDto {
  /// Returns a callable class that can be used as follows: `instanceOfIefDto.copyWith(...)` or like so:`instanceOfIefDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$IefDtoCWProxy get copyWith => _$IefDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

IefDto _$IefDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('IefDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'code',
          'name',
          'departementId',
          'departementName',
          'regionName',
          'isActive',
          'updatedAt',
        ],
      );
      final val = IefDto(
        id: $checkedConvert('id', (v) => v as String),
        code: $checkedConvert('code', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        departementId: $checkedConvert('departementId', (v) => v as String),
        departementName: $checkedConvert('departementName', (v) => v as String),
        regionName: $checkedConvert('regionName', (v) => v as String),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$IefDtoToJson(IefDto instance) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'name': instance.name,
  'departementId': instance.departementId,
  'departementName': instance.departementName,
  'regionName': instance.regionName,
  'isActive': instance.isActive,
  'updatedAt': instance.updatedAt.toIso8601String(),
};
