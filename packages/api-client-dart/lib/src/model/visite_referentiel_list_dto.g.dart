// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_referentiel_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteReferentielListDtoCWProxy {
  VisiteReferentielListDto items(List<VisiteReferentielDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteReferentielListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteReferentielListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteReferentielListDto call({List<VisiteReferentielDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteReferentielListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteReferentielListDto.copyWith.fieldName(...)`
class _$VisiteReferentielListDtoCWProxyImpl
    implements _$VisiteReferentielListDtoCWProxy {
  const _$VisiteReferentielListDtoCWProxyImpl(this._value);

  final VisiteReferentielListDto _value;

  @override
  VisiteReferentielListDto items(List<VisiteReferentielDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteReferentielListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteReferentielListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteReferentielListDto call({
    Object? items = const $CopyWithPlaceholder(),
  }) {
    return VisiteReferentielListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<VisiteReferentielDto>,
    );
  }
}

extension $VisiteReferentielListDtoCopyWith on VisiteReferentielListDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteReferentielListDto.copyWith(...)` or like so:`instanceOfVisiteReferentielListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteReferentielListDtoCWProxy get copyWith =>
      _$VisiteReferentielListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteReferentielListDto _$VisiteReferentielListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteReferentielListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = VisiteReferentielListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => VisiteReferentielDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$VisiteReferentielListDtoToJson(
  VisiteReferentielListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
