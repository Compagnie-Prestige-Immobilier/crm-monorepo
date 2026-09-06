// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'retirer_teleconseiller_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RetirerTeleconseillerDtoCWProxy {
  RetirerTeleconseillerDto teleconseillerId(String teleconseillerId);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RetirerTeleconseillerDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RetirerTeleconseillerDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RetirerTeleconseillerDto call({String teleconseillerId});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRetirerTeleconseillerDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRetirerTeleconseillerDto.copyWith.fieldName(...)`
class _$RetirerTeleconseillerDtoCWProxyImpl
    implements _$RetirerTeleconseillerDtoCWProxy {
  const _$RetirerTeleconseillerDtoCWProxyImpl(this._value);

  final RetirerTeleconseillerDto _value;

  @override
  RetirerTeleconseillerDto teleconseillerId(String teleconseillerId) =>
      this(teleconseillerId: teleconseillerId);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RetirerTeleconseillerDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RetirerTeleconseillerDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RetirerTeleconseillerDto call({
    Object? teleconseillerId = const $CopyWithPlaceholder(),
  }) {
    return RetirerTeleconseillerDto(
      teleconseillerId: teleconseillerId == const $CopyWithPlaceholder()
          ? _value.teleconseillerId
          // ignore: cast_nullable_to_non_nullable
          : teleconseillerId as String,
    );
  }
}

extension $RetirerTeleconseillerDtoCopyWith on RetirerTeleconseillerDto {
  /// Returns a callable class that can be used as follows: `instanceOfRetirerTeleconseillerDto.copyWith(...)` or like so:`instanceOfRetirerTeleconseillerDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RetirerTeleconseillerDtoCWProxy get copyWith =>
      _$RetirerTeleconseillerDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RetirerTeleconseillerDto _$RetirerTeleconseillerDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RetirerTeleconseillerDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['teleconseillerId']);
  final val = RetirerTeleconseillerDto(
    teleconseillerId: $checkedConvert('teleconseillerId', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$RetirerTeleconseillerDtoToJson(
  RetirerTeleconseillerDto instance,
) => <String, dynamic>{'teleconseillerId': instance.teleconseillerId};
