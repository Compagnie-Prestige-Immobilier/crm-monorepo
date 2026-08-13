// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_template_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$NotificationTemplateListDtoCWProxy {
  NotificationTemplateListDto items(List<NotificationTemplateDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationTemplateListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationTemplateListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationTemplateListDto call({List<NotificationTemplateDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfNotificationTemplateListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfNotificationTemplateListDto.copyWith.fieldName(...)`
class _$NotificationTemplateListDtoCWProxyImpl
    implements _$NotificationTemplateListDtoCWProxy {
  const _$NotificationTemplateListDtoCWProxyImpl(this._value);

  final NotificationTemplateListDto _value;

  @override
  NotificationTemplateListDto items(List<NotificationTemplateDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationTemplateListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationTemplateListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationTemplateListDto call({
    Object? items = const $CopyWithPlaceholder(),
  }) {
    return NotificationTemplateListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<NotificationTemplateDto>,
    );
  }
}

extension $NotificationTemplateListDtoCopyWith on NotificationTemplateListDto {
  /// Returns a callable class that can be used as follows: `instanceOfNotificationTemplateListDto.copyWith(...)` or like so:`instanceOfNotificationTemplateListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$NotificationTemplateListDtoCWProxy get copyWith =>
      _$NotificationTemplateListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NotificationTemplateListDto _$NotificationTemplateListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NotificationTemplateListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = NotificationTemplateListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) => NotificationTemplateDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$NotificationTemplateListDtoToJson(
  NotificationTemplateListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
