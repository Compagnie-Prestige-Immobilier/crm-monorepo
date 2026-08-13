// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'inbox_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$InboxDtoCWProxy {
  InboxDto items(List<InboxItemDto> items);

  InboxDto unreadCount(num unreadCount);

  InboxDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `InboxDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// InboxDto(...).copyWith(id: 12, name: "My name")
  /// ````
  InboxDto call({List<InboxItemDto> items, num unreadCount, PageMetaDto meta});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfInboxDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfInboxDto.copyWith.fieldName(...)`
class _$InboxDtoCWProxyImpl implements _$InboxDtoCWProxy {
  const _$InboxDtoCWProxyImpl(this._value);

  final InboxDto _value;

  @override
  InboxDto items(List<InboxItemDto> items) => this(items: items);

  @override
  InboxDto unreadCount(num unreadCount) => this(unreadCount: unreadCount);

  @override
  InboxDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `InboxDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// InboxDto(...).copyWith(id: 12, name: "My name")
  /// ````
  InboxDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? unreadCount = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return InboxDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<InboxItemDto>,
      unreadCount: unreadCount == const $CopyWithPlaceholder()
          ? _value.unreadCount
          // ignore: cast_nullable_to_non_nullable
          : unreadCount as num,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $InboxDtoCopyWith on InboxDto {
  /// Returns a callable class that can be used as follows: `instanceOfInboxDto.copyWith(...)` or like so:`instanceOfInboxDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$InboxDtoCWProxy get copyWith => _$InboxDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InboxDto _$InboxDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('InboxDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'unreadCount', 'meta']);
      final val = InboxDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => InboxItemDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        unreadCount: $checkedConvert('unreadCount', (v) => v as num),
        meta: $checkedConvert(
          'meta',
          (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$InboxDtoToJson(InboxDto instance) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'unreadCount': instance.unreadCount,
  'meta': instance.meta.toJson(),
};
