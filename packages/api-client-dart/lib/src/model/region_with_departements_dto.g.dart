// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'region_with_departements_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RegionWithDepartementsDtoCWProxy {
  RegionWithDepartementsDto id(String id);

  RegionWithDepartementsDto code(String code);

  RegionWithDepartementsDto name(String name);

  RegionWithDepartementsDto departements(List<DepartementDto> departements);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RegionWithDepartementsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RegionWithDepartementsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RegionWithDepartementsDto call({
    String id,
    String code,
    String name,
    List<DepartementDto> departements,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRegionWithDepartementsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRegionWithDepartementsDto.copyWith.fieldName(...)`
class _$RegionWithDepartementsDtoCWProxyImpl
    implements _$RegionWithDepartementsDtoCWProxy {
  const _$RegionWithDepartementsDtoCWProxyImpl(this._value);

  final RegionWithDepartementsDto _value;

  @override
  RegionWithDepartementsDto id(String id) => this(id: id);

  @override
  RegionWithDepartementsDto code(String code) => this(code: code);

  @override
  RegionWithDepartementsDto name(String name) => this(name: name);

  @override
  RegionWithDepartementsDto departements(List<DepartementDto> departements) =>
      this(departements: departements);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RegionWithDepartementsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RegionWithDepartementsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RegionWithDepartementsDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? departements = const $CopyWithPlaceholder(),
  }) {
    return RegionWithDepartementsDto(
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
      departements: departements == const $CopyWithPlaceholder()
          ? _value.departements
          // ignore: cast_nullable_to_non_nullable
          : departements as List<DepartementDto>,
    );
  }
}

extension $RegionWithDepartementsDtoCopyWith on RegionWithDepartementsDto {
  /// Returns a callable class that can be used as follows: `instanceOfRegionWithDepartementsDto.copyWith(...)` or like so:`instanceOfRegionWithDepartementsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RegionWithDepartementsDtoCWProxy get copyWith =>
      _$RegionWithDepartementsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RegionWithDepartementsDto _$RegionWithDepartementsDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RegionWithDepartementsDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['id', 'code', 'name', 'departements']);
  final val = RegionWithDepartementsDto(
    id: $checkedConvert('id', (v) => v as String),
    code: $checkedConvert('code', (v) => v as String),
    name: $checkedConvert('name', (v) => v as String),
    departements: $checkedConvert(
      'departements',
      (v) => (v as List<dynamic>)
          .map((e) => DepartementDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$RegionWithDepartementsDtoToJson(
  RegionWithDepartementsDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'name': instance.name,
  'departements': instance.departements.map((e) => e.toJson()).toList(),
};
