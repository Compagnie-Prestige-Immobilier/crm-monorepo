// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'suggestion_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SuggestionListDtoCWProxy {
  SuggestionListDto items(List<SuggestionDto> items);

  SuggestionListDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SuggestionListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SuggestionListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SuggestionListDto call({List<SuggestionDto> items, PageMetaDto meta});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSuggestionListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSuggestionListDto.copyWith.fieldName(...)`
class _$SuggestionListDtoCWProxyImpl implements _$SuggestionListDtoCWProxy {
  const _$SuggestionListDtoCWProxyImpl(this._value);

  final SuggestionListDto _value;

  @override
  SuggestionListDto items(List<SuggestionDto> items) => this(items: items);

  @override
  SuggestionListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SuggestionListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SuggestionListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SuggestionListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return SuggestionListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<SuggestionDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $SuggestionListDtoCopyWith on SuggestionListDto {
  /// Returns a callable class that can be used as follows: `instanceOfSuggestionListDto.copyWith(...)` or like so:`instanceOfSuggestionListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SuggestionListDtoCWProxy get copyWith =>
      _$SuggestionListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SuggestionListDto _$SuggestionListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SuggestionListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'meta']);
      final val = SuggestionListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => SuggestionDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        meta: $checkedConvert(
          'meta',
          (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SuggestionListDtoToJson(SuggestionListDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'meta': instance.meta.toJson(),
    };
