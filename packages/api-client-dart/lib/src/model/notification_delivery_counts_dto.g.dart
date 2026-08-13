// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_delivery_counts_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$NotificationDeliveryCountsDtoCWProxy {
  NotificationDeliveryCountsDto total(num total);

  NotificationDeliveryCountsDto pending(num pending);

  NotificationDeliveryCountsDto sent(num sent);

  NotificationDeliveryCountsDto delivered(num delivered);

  NotificationDeliveryCountsDto failed(num failed);

  NotificationDeliveryCountsDto read(num read);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationDeliveryCountsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationDeliveryCountsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationDeliveryCountsDto call({
    num total,
    num pending,
    num sent,
    num delivered,
    num failed,
    num read,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfNotificationDeliveryCountsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfNotificationDeliveryCountsDto.copyWith.fieldName(...)`
class _$NotificationDeliveryCountsDtoCWProxyImpl
    implements _$NotificationDeliveryCountsDtoCWProxy {
  const _$NotificationDeliveryCountsDtoCWProxyImpl(this._value);

  final NotificationDeliveryCountsDto _value;

  @override
  NotificationDeliveryCountsDto total(num total) => this(total: total);

  @override
  NotificationDeliveryCountsDto pending(num pending) => this(pending: pending);

  @override
  NotificationDeliveryCountsDto sent(num sent) => this(sent: sent);

  @override
  NotificationDeliveryCountsDto delivered(num delivered) =>
      this(delivered: delivered);

  @override
  NotificationDeliveryCountsDto failed(num failed) => this(failed: failed);

  @override
  NotificationDeliveryCountsDto read(num read) => this(read: read);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationDeliveryCountsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationDeliveryCountsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationDeliveryCountsDto call({
    Object? total = const $CopyWithPlaceholder(),
    Object? pending = const $CopyWithPlaceholder(),
    Object? sent = const $CopyWithPlaceholder(),
    Object? delivered = const $CopyWithPlaceholder(),
    Object? failed = const $CopyWithPlaceholder(),
    Object? read = const $CopyWithPlaceholder(),
  }) {
    return NotificationDeliveryCountsDto(
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
      pending: pending == const $CopyWithPlaceholder()
          ? _value.pending
          // ignore: cast_nullable_to_non_nullable
          : pending as num,
      sent: sent == const $CopyWithPlaceholder()
          ? _value.sent
          // ignore: cast_nullable_to_non_nullable
          : sent as num,
      delivered: delivered == const $CopyWithPlaceholder()
          ? _value.delivered
          // ignore: cast_nullable_to_non_nullable
          : delivered as num,
      failed: failed == const $CopyWithPlaceholder()
          ? _value.failed
          // ignore: cast_nullable_to_non_nullable
          : failed as num,
      read: read == const $CopyWithPlaceholder()
          ? _value.read
          // ignore: cast_nullable_to_non_nullable
          : read as num,
    );
  }
}

extension $NotificationDeliveryCountsDtoCopyWith
    on NotificationDeliveryCountsDto {
  /// Returns a callable class that can be used as follows: `instanceOfNotificationDeliveryCountsDto.copyWith(...)` or like so:`instanceOfNotificationDeliveryCountsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$NotificationDeliveryCountsDtoCWProxy get copyWith =>
      _$NotificationDeliveryCountsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NotificationDeliveryCountsDto _$NotificationDeliveryCountsDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NotificationDeliveryCountsDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'total',
      'pending',
      'sent',
      'delivered',
      'failed',
      'read',
    ],
  );
  final val = NotificationDeliveryCountsDto(
    total: $checkedConvert('total', (v) => v as num),
    pending: $checkedConvert('pending', (v) => v as num),
    sent: $checkedConvert('sent', (v) => v as num),
    delivered: $checkedConvert('delivered', (v) => v as num),
    failed: $checkedConvert('failed', (v) => v as num),
    read: $checkedConvert('read', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$NotificationDeliveryCountsDtoToJson(
  NotificationDeliveryCountsDto instance,
) => <String, dynamic>{
  'total': instance.total,
  'pending': instance.pending,
  'sent': instance.sent,
  'delivered': instance.delivered,
  'failed': instance.failed,
  'read': instance.read,
};
