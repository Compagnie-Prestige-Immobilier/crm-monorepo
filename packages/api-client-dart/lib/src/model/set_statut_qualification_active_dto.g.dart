// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'set_statut_qualification_active_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SetStatutQualificationActiveDtoCWProxy {
  SetStatutQualificationActiveDto isActive(bool isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SetStatutQualificationActiveDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SetStatutQualificationActiveDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SetStatutQualificationActiveDto call({bool isActive});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSetStatutQualificationActiveDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSetStatutQualificationActiveDto.copyWith.fieldName(...)`
class _$SetStatutQualificationActiveDtoCWProxyImpl
    implements _$SetStatutQualificationActiveDtoCWProxy {
  const _$SetStatutQualificationActiveDtoCWProxyImpl(this._value);

  final SetStatutQualificationActiveDto _value;

  @override
  SetStatutQualificationActiveDto isActive(bool isActive) =>
      this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SetStatutQualificationActiveDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SetStatutQualificationActiveDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SetStatutQualificationActiveDto call({
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return SetStatutQualificationActiveDto(
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
    );
  }
}

extension $SetStatutQualificationActiveDtoCopyWith
    on SetStatutQualificationActiveDto {
  /// Returns a callable class that can be used as follows: `instanceOfSetStatutQualificationActiveDto.copyWith(...)` or like so:`instanceOfSetStatutQualificationActiveDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SetStatutQualificationActiveDtoCWProxy get copyWith =>
      _$SetStatutQualificationActiveDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SetStatutQualificationActiveDto _$SetStatutQualificationActiveDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SetStatutQualificationActiveDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['isActive']);
  final val = SetStatutQualificationActiveDto(
    isActive: $checkedConvert('isActive', (v) => v as bool),
  );
  return val;
});

Map<String, dynamic> _$SetStatutQualificationActiveDtoToJson(
  SetStatutQualificationActiveDto instance,
) => <String, dynamic>{'isActive': instance.isActive};
