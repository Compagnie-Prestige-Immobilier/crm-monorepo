// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'representant_fiche_change_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepresentantFicheChangeListDtoCWProxy {
  RepresentantFicheChangeListDto items(List<RepresentantFicheChangeDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantFicheChangeListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantFicheChangeListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantFicheChangeListDto call({List<RepresentantFicheChangeDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepresentantFicheChangeListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepresentantFicheChangeListDto.copyWith.fieldName(...)`
class _$RepresentantFicheChangeListDtoCWProxyImpl
    implements _$RepresentantFicheChangeListDtoCWProxy {
  const _$RepresentantFicheChangeListDtoCWProxyImpl(this._value);

  final RepresentantFicheChangeListDto _value;

  @override
  RepresentantFicheChangeListDto items(
    List<RepresentantFicheChangeDto> items,
  ) => this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantFicheChangeListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantFicheChangeListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantFicheChangeListDto call({
    Object? items = const $CopyWithPlaceholder(),
  }) {
    return RepresentantFicheChangeListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<RepresentantFicheChangeDto>,
    );
  }
}

extension $RepresentantFicheChangeListDtoCopyWith
    on RepresentantFicheChangeListDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepresentantFicheChangeListDto.copyWith(...)` or like so:`instanceOfRepresentantFicheChangeListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepresentantFicheChangeListDtoCWProxy get copyWith =>
      _$RepresentantFicheChangeListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepresentantFicheChangeListDto _$RepresentantFicheChangeListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepresentantFicheChangeListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = RepresentantFicheChangeListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                RepresentantFicheChangeDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$RepresentantFicheChangeListDtoToJson(
  RepresentantFicheChangeListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
