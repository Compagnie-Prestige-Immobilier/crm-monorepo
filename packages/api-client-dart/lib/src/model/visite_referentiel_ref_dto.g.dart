// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_referentiel_ref_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteReferentielRefDtoCWProxy {
  VisiteReferentielRefDto id(String id);

  VisiteReferentielRefDto code(String code);

  VisiteReferentielRefDto label(String label);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteReferentielRefDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteReferentielRefDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteReferentielRefDto call({String id, String code, String label});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteReferentielRefDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteReferentielRefDto.copyWith.fieldName(...)`
class _$VisiteReferentielRefDtoCWProxyImpl
    implements _$VisiteReferentielRefDtoCWProxy {
  const _$VisiteReferentielRefDtoCWProxyImpl(this._value);

  final VisiteReferentielRefDto _value;

  @override
  VisiteReferentielRefDto id(String id) => this(id: id);

  @override
  VisiteReferentielRefDto code(String code) => this(code: code);

  @override
  VisiteReferentielRefDto label(String label) => this(label: label);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteReferentielRefDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteReferentielRefDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteReferentielRefDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
  }) {
    return VisiteReferentielRefDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
    );
  }
}

extension $VisiteReferentielRefDtoCopyWith on VisiteReferentielRefDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteReferentielRefDto.copyWith(...)` or like so:`instanceOfVisiteReferentielRefDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteReferentielRefDtoCWProxy get copyWith =>
      _$VisiteReferentielRefDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteReferentielRefDto _$VisiteReferentielRefDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteReferentielRefDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['id', 'code', 'label']);
  final val = VisiteReferentielRefDto(
    id: $checkedConvert('id', (v) => v as String),
    code: $checkedConvert('code', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$VisiteReferentielRefDtoToJson(
  VisiteReferentielRefDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'label': instance.label,
};
