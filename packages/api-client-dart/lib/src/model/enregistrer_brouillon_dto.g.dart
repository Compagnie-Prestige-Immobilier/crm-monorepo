// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'enregistrer_brouillon_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$EnregistrerBrouillonDtoCWProxy {
  EnregistrerBrouillonDto draft(Map<String, Object> draft);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `EnregistrerBrouillonDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// EnregistrerBrouillonDto(...).copyWith(id: 12, name: "My name")
  /// ````
  EnregistrerBrouillonDto call({Map<String, Object> draft});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfEnregistrerBrouillonDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfEnregistrerBrouillonDto.copyWith.fieldName(...)`
class _$EnregistrerBrouillonDtoCWProxyImpl
    implements _$EnregistrerBrouillonDtoCWProxy {
  const _$EnregistrerBrouillonDtoCWProxyImpl(this._value);

  final EnregistrerBrouillonDto _value;

  @override
  EnregistrerBrouillonDto draft(Map<String, Object> draft) =>
      this(draft: draft);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `EnregistrerBrouillonDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// EnregistrerBrouillonDto(...).copyWith(id: 12, name: "My name")
  /// ````
  EnregistrerBrouillonDto call({Object? draft = const $CopyWithPlaceholder()}) {
    return EnregistrerBrouillonDto(
      draft: draft == const $CopyWithPlaceholder()
          ? _value.draft
          // ignore: cast_nullable_to_non_nullable
          : draft as Map<String, Object>,
    );
  }
}

extension $EnregistrerBrouillonDtoCopyWith on EnregistrerBrouillonDto {
  /// Returns a callable class that can be used as follows: `instanceOfEnregistrerBrouillonDto.copyWith(...)` or like so:`instanceOfEnregistrerBrouillonDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$EnregistrerBrouillonDtoCWProxy get copyWith =>
      _$EnregistrerBrouillonDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

EnregistrerBrouillonDto _$EnregistrerBrouillonDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('EnregistrerBrouillonDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['draft']);
  final val = EnregistrerBrouillonDto(
    draft: $checkedConvert(
      'draft',
      (v) =>
          (v as Map<String, dynamic>).map((k, e) => MapEntry(k, e as Object)),
    ),
  );
  return val;
});

Map<String, dynamic> _$EnregistrerBrouillonDtoToJson(
  EnregistrerBrouillonDto instance,
) => <String, dynamic>{'draft': instance.draft};
