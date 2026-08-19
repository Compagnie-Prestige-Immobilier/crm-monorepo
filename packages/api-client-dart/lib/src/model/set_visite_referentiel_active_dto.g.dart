// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'set_visite_referentiel_active_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SetVisiteReferentielActiveDtoCWProxy {
  SetVisiteReferentielActiveDto isActive(bool isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SetVisiteReferentielActiveDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SetVisiteReferentielActiveDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SetVisiteReferentielActiveDto call({bool isActive});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSetVisiteReferentielActiveDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSetVisiteReferentielActiveDto.copyWith.fieldName(...)`
class _$SetVisiteReferentielActiveDtoCWProxyImpl
    implements _$SetVisiteReferentielActiveDtoCWProxy {
  const _$SetVisiteReferentielActiveDtoCWProxyImpl(this._value);

  final SetVisiteReferentielActiveDto _value;

  @override
  SetVisiteReferentielActiveDto isActive(bool isActive) =>
      this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SetVisiteReferentielActiveDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SetVisiteReferentielActiveDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SetVisiteReferentielActiveDto call({
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return SetVisiteReferentielActiveDto(
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
    );
  }
}

extension $SetVisiteReferentielActiveDtoCopyWith
    on SetVisiteReferentielActiveDto {
  /// Returns a callable class that can be used as follows: `instanceOfSetVisiteReferentielActiveDto.copyWith(...)` or like so:`instanceOfSetVisiteReferentielActiveDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SetVisiteReferentielActiveDtoCWProxy get copyWith =>
      _$SetVisiteReferentielActiveDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SetVisiteReferentielActiveDto _$SetVisiteReferentielActiveDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SetVisiteReferentielActiveDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['isActive']);
  final val = SetVisiteReferentielActiveDto(
    isActive: $checkedConvert('isActive', (v) => v as bool),
  );
  return val;
});

Map<String, dynamic> _$SetVisiteReferentielActiveDtoToJson(
  SetVisiteReferentielActiveDto instance,
) => <String, dynamic>{'isActive': instance.isActive};
