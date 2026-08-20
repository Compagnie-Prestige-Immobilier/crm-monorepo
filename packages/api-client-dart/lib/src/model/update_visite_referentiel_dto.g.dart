// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_visite_referentiel_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateVisiteReferentielDtoCWProxy {
  UpdateVisiteReferentielDto label(String? label);

  UpdateVisiteReferentielDto sortOrder(num? sortOrder);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateVisiteReferentielDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateVisiteReferentielDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateVisiteReferentielDto call({String? label, num? sortOrder});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateVisiteReferentielDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateVisiteReferentielDto.copyWith.fieldName(...)`
class _$UpdateVisiteReferentielDtoCWProxyImpl
    implements _$UpdateVisiteReferentielDtoCWProxy {
  const _$UpdateVisiteReferentielDtoCWProxyImpl(this._value);

  final UpdateVisiteReferentielDto _value;

  @override
  UpdateVisiteReferentielDto label(String? label) => this(label: label);

  @override
  UpdateVisiteReferentielDto sortOrder(num? sortOrder) =>
      this(sortOrder: sortOrder);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateVisiteReferentielDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateVisiteReferentielDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateVisiteReferentielDto call({
    Object? label = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
  }) {
    return UpdateVisiteReferentielDto(
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String?,
      sortOrder: sortOrder == const $CopyWithPlaceholder()
          ? _value.sortOrder
          // ignore: cast_nullable_to_non_nullable
          : sortOrder as num?,
    );
  }
}

extension $UpdateVisiteReferentielDtoCopyWith on UpdateVisiteReferentielDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateVisiteReferentielDto.copyWith(...)` or like so:`instanceOfUpdateVisiteReferentielDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateVisiteReferentielDtoCWProxy get copyWith =>
      _$UpdateVisiteReferentielDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateVisiteReferentielDto _$UpdateVisiteReferentielDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateVisiteReferentielDto', json, ($checkedConvert) {
  final val = UpdateVisiteReferentielDto(
    label: $checkedConvert('label', (v) => v as String?),
    sortOrder: $checkedConvert('sortOrder', (v) => v as num?),
  );
  return val;
});

Map<String, dynamic> _$UpdateVisiteReferentielDtoToJson(
  UpdateVisiteReferentielDto instance,
) => <String, dynamic>{
  if (instance.label case final value?) 'label': value,
  if (instance.sortOrder case final value?) 'sortOrder': value,
};
