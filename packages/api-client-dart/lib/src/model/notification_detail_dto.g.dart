// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_detail_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$NotificationDetailDtoCWProxy {
  NotificationDetailDto notification(NotificationDto notification);

  NotificationDetailDto recipients(List<NotificationRecipientDto> recipients);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationDetailDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationDetailDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationDetailDto call({
    NotificationDto notification,
    List<NotificationRecipientDto> recipients,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfNotificationDetailDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfNotificationDetailDto.copyWith.fieldName(...)`
class _$NotificationDetailDtoCWProxyImpl
    implements _$NotificationDetailDtoCWProxy {
  const _$NotificationDetailDtoCWProxyImpl(this._value);

  final NotificationDetailDto _value;

  @override
  NotificationDetailDto notification(NotificationDto notification) =>
      this(notification: notification);

  @override
  NotificationDetailDto recipients(List<NotificationRecipientDto> recipients) =>
      this(recipients: recipients);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationDetailDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationDetailDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationDetailDto call({
    Object? notification = const $CopyWithPlaceholder(),
    Object? recipients = const $CopyWithPlaceholder(),
  }) {
    return NotificationDetailDto(
      notification: notification == const $CopyWithPlaceholder()
          ? _value.notification
          // ignore: cast_nullable_to_non_nullable
          : notification as NotificationDto,
      recipients: recipients == const $CopyWithPlaceholder()
          ? _value.recipients
          // ignore: cast_nullable_to_non_nullable
          : recipients as List<NotificationRecipientDto>,
    );
  }
}

extension $NotificationDetailDtoCopyWith on NotificationDetailDto {
  /// Returns a callable class that can be used as follows: `instanceOfNotificationDetailDto.copyWith(...)` or like so:`instanceOfNotificationDetailDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$NotificationDetailDtoCWProxy get copyWith =>
      _$NotificationDetailDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NotificationDetailDto _$NotificationDetailDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NotificationDetailDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['notification', 'recipients']);
  final val = NotificationDetailDto(
    notification: $checkedConvert(
      'notification',
      (v) => NotificationDto.fromJson(v as Map<String, dynamic>),
    ),
    recipients: $checkedConvert(
      'recipients',
      (v) => (v as List<dynamic>)
          .map(
            (e) => NotificationRecipientDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$NotificationDetailDtoToJson(
  NotificationDetailDto instance,
) => <String, dynamic>{
  'notification': instance.notification.toJson(),
  'recipients': instance.recipients.map((e) => e.toJson()).toList(),
};
