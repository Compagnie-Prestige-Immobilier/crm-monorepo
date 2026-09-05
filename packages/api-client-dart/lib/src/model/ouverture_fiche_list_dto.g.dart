// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ouverture_fiche_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$OuvertureFicheListDtoCWProxy {
  OuvertureFicheListDto items(List<OuvertureFicheDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OuvertureFicheListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OuvertureFicheListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OuvertureFicheListDto call({List<OuvertureFicheDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfOuvertureFicheListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfOuvertureFicheListDto.copyWith.fieldName(...)`
class _$OuvertureFicheListDtoCWProxyImpl
    implements _$OuvertureFicheListDtoCWProxy {
  const _$OuvertureFicheListDtoCWProxyImpl(this._value);

  final OuvertureFicheListDto _value;

  @override
  OuvertureFicheListDto items(List<OuvertureFicheDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OuvertureFicheListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OuvertureFicheListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OuvertureFicheListDto call({Object? items = const $CopyWithPlaceholder()}) {
    return OuvertureFicheListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<OuvertureFicheDto>,
    );
  }
}

extension $OuvertureFicheListDtoCopyWith on OuvertureFicheListDto {
  /// Returns a callable class that can be used as follows: `instanceOfOuvertureFicheListDto.copyWith(...)` or like so:`instanceOfOuvertureFicheListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$OuvertureFicheListDtoCWProxy get copyWith =>
      _$OuvertureFicheListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OuvertureFicheListDto _$OuvertureFicheListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('OuvertureFicheListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = OuvertureFicheListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => OuvertureFicheDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$OuvertureFicheListDtoToJson(
  OuvertureFicheListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
