// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'parametre_changement_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ParametreChangementDtoCWProxy {
  ParametreChangementDto id(String id);

  ParametreChangementDto cle(String cle);

  ParametreChangementDto ancienne(String? ancienne);

  ParametreChangementDto nouvelle(String nouvelle);

  ParametreChangementDto parNom(String parNom);

  ParametreChangementDto le(String le);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ParametreChangementDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ParametreChangementDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ParametreChangementDto call({
    String id,
    String cle,
    String? ancienne,
    String nouvelle,
    String parNom,
    String le,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfParametreChangementDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfParametreChangementDto.copyWith.fieldName(...)`
class _$ParametreChangementDtoCWProxyImpl
    implements _$ParametreChangementDtoCWProxy {
  const _$ParametreChangementDtoCWProxyImpl(this._value);

  final ParametreChangementDto _value;

  @override
  ParametreChangementDto id(String id) => this(id: id);

  @override
  ParametreChangementDto cle(String cle) => this(cle: cle);

  @override
  ParametreChangementDto ancienne(String? ancienne) => this(ancienne: ancienne);

  @override
  ParametreChangementDto nouvelle(String nouvelle) => this(nouvelle: nouvelle);

  @override
  ParametreChangementDto parNom(String parNom) => this(parNom: parNom);

  @override
  ParametreChangementDto le(String le) => this(le: le);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ParametreChangementDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ParametreChangementDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ParametreChangementDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? cle = const $CopyWithPlaceholder(),
    Object? ancienne = const $CopyWithPlaceholder(),
    Object? nouvelle = const $CopyWithPlaceholder(),
    Object? parNom = const $CopyWithPlaceholder(),
    Object? le = const $CopyWithPlaceholder(),
  }) {
    return ParametreChangementDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      cle: cle == const $CopyWithPlaceholder()
          ? _value.cle
          // ignore: cast_nullable_to_non_nullable
          : cle as String,
      ancienne: ancienne == const $CopyWithPlaceholder()
          ? _value.ancienne
          // ignore: cast_nullable_to_non_nullable
          : ancienne as String?,
      nouvelle: nouvelle == const $CopyWithPlaceholder()
          ? _value.nouvelle
          // ignore: cast_nullable_to_non_nullable
          : nouvelle as String,
      parNom: parNom == const $CopyWithPlaceholder()
          ? _value.parNom
          // ignore: cast_nullable_to_non_nullable
          : parNom as String,
      le: le == const $CopyWithPlaceholder()
          ? _value.le
          // ignore: cast_nullable_to_non_nullable
          : le as String,
    );
  }
}

extension $ParametreChangementDtoCopyWith on ParametreChangementDto {
  /// Returns a callable class that can be used as follows: `instanceOfParametreChangementDto.copyWith(...)` or like so:`instanceOfParametreChangementDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ParametreChangementDtoCWProxy get copyWith =>
      _$ParametreChangementDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ParametreChangementDto _$ParametreChangementDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ParametreChangementDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['id', 'cle', 'ancienne', 'nouvelle', 'parNom', 'le'],
  );
  final val = ParametreChangementDto(
    id: $checkedConvert('id', (v) => v as String),
    cle: $checkedConvert('cle', (v) => v as String),
    ancienne: $checkedConvert('ancienne', (v) => v as String?),
    nouvelle: $checkedConvert('nouvelle', (v) => v as String),
    parNom: $checkedConvert('parNom', (v) => v as String),
    le: $checkedConvert('le', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$ParametreChangementDtoToJson(
  ParametreChangementDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'cle': instance.cle,
  'ancienne': instance.ancienne,
  'nouvelle': instance.nouvelle,
  'parNom': instance.parNom,
  'le': instance.le,
};
