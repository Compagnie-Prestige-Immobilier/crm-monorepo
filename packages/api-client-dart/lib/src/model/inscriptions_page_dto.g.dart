// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'inscriptions_page_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$InscriptionsPageDtoCWProxy {
  InscriptionsPageDto items(List<InscriptionPlateformeDto> items);

  InscriptionsPageDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `InscriptionsPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// InscriptionsPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  InscriptionsPageDto call({
    List<InscriptionPlateformeDto> items,
    PageMetaDto meta,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfInscriptionsPageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfInscriptionsPageDto.copyWith.fieldName(...)`
class _$InscriptionsPageDtoCWProxyImpl implements _$InscriptionsPageDtoCWProxy {
  const _$InscriptionsPageDtoCWProxyImpl(this._value);

  final InscriptionsPageDto _value;

  @override
  InscriptionsPageDto items(List<InscriptionPlateformeDto> items) =>
      this(items: items);

  @override
  InscriptionsPageDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `InscriptionsPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// InscriptionsPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  InscriptionsPageDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return InscriptionsPageDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<InscriptionPlateformeDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $InscriptionsPageDtoCopyWith on InscriptionsPageDto {
  /// Returns a callable class that can be used as follows: `instanceOfInscriptionsPageDto.copyWith(...)` or like so:`instanceOfInscriptionsPageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$InscriptionsPageDtoCWProxy get copyWith =>
      _$InscriptionsPageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InscriptionsPageDto _$InscriptionsPageDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('InscriptionsPageDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'meta']);
      final val = InscriptionsPageDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map(
                (e) => InscriptionPlateformeDto.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList(),
        ),
        meta: $checkedConvert(
          'meta',
          (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$InscriptionsPageDtoToJson(
  InscriptionsPageDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'meta': instance.meta.toJson(),
};
