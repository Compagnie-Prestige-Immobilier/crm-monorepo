// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supervision_teleconseiller_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SupervisionTeleconseillerDtoCWProxy {
  SupervisionTeleconseillerDto id(String id);

  SupervisionTeleconseillerDto fullName(String fullName);

  SupervisionTeleconseillerDto isActive(bool isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionTeleconseillerDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionTeleconseillerDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionTeleconseillerDto call({
    String id,
    String fullName,
    bool isActive,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSupervisionTeleconseillerDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSupervisionTeleconseillerDto.copyWith.fieldName(...)`
class _$SupervisionTeleconseillerDtoCWProxyImpl
    implements _$SupervisionTeleconseillerDtoCWProxy {
  const _$SupervisionTeleconseillerDtoCWProxyImpl(this._value);

  final SupervisionTeleconseillerDto _value;

  @override
  SupervisionTeleconseillerDto id(String id) => this(id: id);

  @override
  SupervisionTeleconseillerDto fullName(String fullName) =>
      this(fullName: fullName);

  @override
  SupervisionTeleconseillerDto isActive(bool isActive) =>
      this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionTeleconseillerDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionTeleconseillerDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionTeleconseillerDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return SupervisionTeleconseillerDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      fullName: fullName == const $CopyWithPlaceholder()
          ? _value.fullName
          // ignore: cast_nullable_to_non_nullable
          : fullName as String,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
    );
  }
}

extension $SupervisionTeleconseillerDtoCopyWith
    on SupervisionTeleconseillerDto {
  /// Returns a callable class that can be used as follows: `instanceOfSupervisionTeleconseillerDto.copyWith(...)` or like so:`instanceOfSupervisionTeleconseillerDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SupervisionTeleconseillerDtoCWProxy get copyWith =>
      _$SupervisionTeleconseillerDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupervisionTeleconseillerDto _$SupervisionTeleconseillerDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SupervisionTeleconseillerDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['id', 'fullName', 'isActive']);
  final val = SupervisionTeleconseillerDto(
    id: $checkedConvert('id', (v) => v as String),
    fullName: $checkedConvert('fullName', (v) => v as String),
    isActive: $checkedConvert('isActive', (v) => v as bool),
  );
  return val;
});

Map<String, dynamic> _$SupervisionTeleconseillerDtoToJson(
  SupervisionTeleconseillerDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'fullName': instance.fullName,
  'isActive': instance.isActive,
};
