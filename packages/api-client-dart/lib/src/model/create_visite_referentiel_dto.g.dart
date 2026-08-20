// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_visite_referentiel_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateVisiteReferentielDtoCWProxy {
  CreateVisiteReferentielDto code(String code);

  CreateVisiteReferentielDto label(String label);

  CreateVisiteReferentielDto sortOrder(num? sortOrder);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateVisiteReferentielDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateVisiteReferentielDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateVisiteReferentielDto call({String code, String label, num? sortOrder});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateVisiteReferentielDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateVisiteReferentielDto.copyWith.fieldName(...)`
class _$CreateVisiteReferentielDtoCWProxyImpl
    implements _$CreateVisiteReferentielDtoCWProxy {
  const _$CreateVisiteReferentielDtoCWProxyImpl(this._value);

  final CreateVisiteReferentielDto _value;

  @override
  CreateVisiteReferentielDto code(String code) => this(code: code);

  @override
  CreateVisiteReferentielDto label(String label) => this(label: label);

  @override
  CreateVisiteReferentielDto sortOrder(num? sortOrder) =>
      this(sortOrder: sortOrder);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateVisiteReferentielDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateVisiteReferentielDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateVisiteReferentielDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
  }) {
    return CreateVisiteReferentielDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      sortOrder: sortOrder == const $CopyWithPlaceholder()
          ? _value.sortOrder
          // ignore: cast_nullable_to_non_nullable
          : sortOrder as num?,
    );
  }
}

extension $CreateVisiteReferentielDtoCopyWith on CreateVisiteReferentielDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateVisiteReferentielDto.copyWith(...)` or like so:`instanceOfCreateVisiteReferentielDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateVisiteReferentielDtoCWProxy get copyWith =>
      _$CreateVisiteReferentielDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateVisiteReferentielDto _$CreateVisiteReferentielDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateVisiteReferentielDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['code', 'label']);
  final val = CreateVisiteReferentielDto(
    code: $checkedConvert('code', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    sortOrder: $checkedConvert('sortOrder', (v) => v as num? ?? 100),
  );
  return val;
});

Map<String, dynamic> _$CreateVisiteReferentielDtoToJson(
  CreateVisiteReferentielDto instance,
) => <String, dynamic>{
  'code': instance.code,
  'label': instance.label,
  if (instance.sortOrder case final value?) 'sortOrder': value,
};
