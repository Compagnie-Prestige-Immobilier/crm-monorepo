// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'region_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RegionDtoCWProxy {
  RegionDto id(String id);

  RegionDto code(String code);

  RegionDto name(String name);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RegionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RegionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RegionDto call({String id, String code, String name});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRegionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRegionDto.copyWith.fieldName(...)`
class _$RegionDtoCWProxyImpl implements _$RegionDtoCWProxy {
  const _$RegionDtoCWProxyImpl(this._value);

  final RegionDto _value;

  @override
  RegionDto id(String id) => this(id: id);

  @override
  RegionDto code(String code) => this(code: code);

  @override
  RegionDto name(String name) => this(name: name);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RegionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RegionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RegionDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
  }) {
    return RegionDto(
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
    );
  }
}

extension $RegionDtoCopyWith on RegionDto {
  /// Returns a callable class that can be used as follows: `instanceOfRegionDto.copyWith(...)` or like so:`instanceOfRegionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RegionDtoCWProxy get copyWith => _$RegionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RegionDto _$RegionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RegionDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['id', 'code', 'name']);
      final val = RegionDto(
        id: $checkedConvert('id', (v) => v as String),
        code: $checkedConvert('code', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$RegionDtoToJson(RegionDto instance) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'name': instance.name,
};
