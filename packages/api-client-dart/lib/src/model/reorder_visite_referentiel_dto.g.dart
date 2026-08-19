// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reorder_visite_referentiel_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ReorderVisiteReferentielDtoCWProxy {
  ReorderVisiteReferentielDto ids(List<String> ids);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReorderVisiteReferentielDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReorderVisiteReferentielDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReorderVisiteReferentielDto call({List<String> ids});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfReorderVisiteReferentielDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfReorderVisiteReferentielDto.copyWith.fieldName(...)`
class _$ReorderVisiteReferentielDtoCWProxyImpl
    implements _$ReorderVisiteReferentielDtoCWProxy {
  const _$ReorderVisiteReferentielDtoCWProxyImpl(this._value);

  final ReorderVisiteReferentielDto _value;

  @override
  ReorderVisiteReferentielDto ids(List<String> ids) => this(ids: ids);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReorderVisiteReferentielDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReorderVisiteReferentielDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReorderVisiteReferentielDto call({
    Object? ids = const $CopyWithPlaceholder(),
  }) {
    return ReorderVisiteReferentielDto(
      ids: ids == const $CopyWithPlaceholder()
          ? _value.ids
          // ignore: cast_nullable_to_non_nullable
          : ids as List<String>,
    );
  }
}

extension $ReorderVisiteReferentielDtoCopyWith on ReorderVisiteReferentielDto {
  /// Returns a callable class that can be used as follows: `instanceOfReorderVisiteReferentielDto.copyWith(...)` or like so:`instanceOfReorderVisiteReferentielDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ReorderVisiteReferentielDtoCWProxy get copyWith =>
      _$ReorderVisiteReferentielDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReorderVisiteReferentielDto _$ReorderVisiteReferentielDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ReorderVisiteReferentielDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['ids']);
  final val = ReorderVisiteReferentielDto(
    ids: $checkedConvert(
      'ids',
      (v) => (v as List<dynamic>).map((e) => e as String).toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$ReorderVisiteReferentielDtoToJson(
  ReorderVisiteReferentielDto instance,
) => <String, dynamic>{'ids': instance.ids};
