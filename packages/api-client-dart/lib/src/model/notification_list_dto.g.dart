// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$NotificationListDtoCWProxy {
  NotificationListDto items(List<NotificationDto> items);

  NotificationListDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationListDto call({List<NotificationDto> items, PageMetaDto meta});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfNotificationListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfNotificationListDto.copyWith.fieldName(...)`
class _$NotificationListDtoCWProxyImpl implements _$NotificationListDtoCWProxy {
  const _$NotificationListDtoCWProxyImpl(this._value);

  final NotificationListDto _value;

  @override
  NotificationListDto items(List<NotificationDto> items) => this(items: items);

  @override
  NotificationListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return NotificationListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<NotificationDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $NotificationListDtoCopyWith on NotificationListDto {
  /// Returns a callable class that can be used as follows: `instanceOfNotificationListDto.copyWith(...)` or like so:`instanceOfNotificationListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$NotificationListDtoCWProxy get copyWith =>
      _$NotificationListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NotificationListDto _$NotificationListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('NotificationListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'meta']);
      final val = NotificationListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => NotificationDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        meta: $checkedConvert(
          'meta',
          (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$NotificationListDtoToJson(
  NotificationListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'meta': instance.meta.toJson(),
};
