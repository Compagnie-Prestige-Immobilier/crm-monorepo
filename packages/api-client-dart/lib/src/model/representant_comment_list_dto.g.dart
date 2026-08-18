// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'representant_comment_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepresentantCommentListDtoCWProxy {
  RepresentantCommentListDto items(List<RepresentantCommentDto> items);

  RepresentantCommentListDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantCommentListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantCommentListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantCommentListDto call({
    List<RepresentantCommentDto> items,
    PageMetaDto meta,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepresentantCommentListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepresentantCommentListDto.copyWith.fieldName(...)`
class _$RepresentantCommentListDtoCWProxyImpl
    implements _$RepresentantCommentListDtoCWProxy {
  const _$RepresentantCommentListDtoCWProxyImpl(this._value);

  final RepresentantCommentListDto _value;

  @override
  RepresentantCommentListDto items(List<RepresentantCommentDto> items) =>
      this(items: items);

  @override
  RepresentantCommentListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantCommentListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantCommentListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantCommentListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return RepresentantCommentListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<RepresentantCommentDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $RepresentantCommentListDtoCopyWith on RepresentantCommentListDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepresentantCommentListDto.copyWith(...)` or like so:`instanceOfRepresentantCommentListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepresentantCommentListDtoCWProxy get copyWith =>
      _$RepresentantCommentListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepresentantCommentListDto _$RepresentantCommentListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepresentantCommentListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'meta']);
  final val = RepresentantCommentListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) => RepresentantCommentDto.fromJson(e as Map<String, dynamic>),
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

Map<String, dynamic> _$RepresentantCommentListDtoToJson(
  RepresentantCommentListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'meta': instance.meta.toJson(),
};
