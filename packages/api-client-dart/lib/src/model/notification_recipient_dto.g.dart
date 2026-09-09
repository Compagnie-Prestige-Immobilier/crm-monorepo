// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_recipient_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$NotificationRecipientDtoCWProxy {
  NotificationRecipientDto userId(String userId);

  NotificationRecipientDto fullName(String fullName);

  NotificationRecipientDto role(Role role);

  NotificationRecipientDto status(NotificationDeliveryStatus status);

  NotificationRecipientDto error(String? error);

  NotificationRecipientDto sentAt(DateTime? sentAt);

  NotificationRecipientDto readAt(DateTime? readAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationRecipientDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationRecipientDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationRecipientDto call({
    String userId,
    String fullName,
    Role role,
    NotificationDeliveryStatus status,
    String? error,
    DateTime? sentAt,
    DateTime? readAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfNotificationRecipientDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfNotificationRecipientDto.copyWith.fieldName(...)`
class _$NotificationRecipientDtoCWProxyImpl
    implements _$NotificationRecipientDtoCWProxy {
  const _$NotificationRecipientDtoCWProxyImpl(this._value);

  final NotificationRecipientDto _value;

  @override
  NotificationRecipientDto userId(String userId) => this(userId: userId);

  @override
  NotificationRecipientDto fullName(String fullName) =>
      this(fullName: fullName);

  @override
  NotificationRecipientDto role(Role role) => this(role: role);

  @override
  NotificationRecipientDto status(NotificationDeliveryStatus status) =>
      this(status: status);

  @override
  NotificationRecipientDto error(String? error) => this(error: error);

  @override
  NotificationRecipientDto sentAt(DateTime? sentAt) => this(sentAt: sentAt);

  @override
  NotificationRecipientDto readAt(DateTime? readAt) => this(readAt: readAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationRecipientDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationRecipientDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationRecipientDto call({
    Object? userId = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? role = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? error = const $CopyWithPlaceholder(),
    Object? sentAt = const $CopyWithPlaceholder(),
    Object? readAt = const $CopyWithPlaceholder(),
  }) {
    return NotificationRecipientDto(
      userId: userId == const $CopyWithPlaceholder()
          ? _value.userId
          // ignore: cast_nullable_to_non_nullable
          : userId as String,
      fullName: fullName == const $CopyWithPlaceholder()
          ? _value.fullName
          // ignore: cast_nullable_to_non_nullable
          : fullName as String,
      role: role == const $CopyWithPlaceholder()
          ? _value.role
          // ignore: cast_nullable_to_non_nullable
          : role as Role,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as NotificationDeliveryStatus,
      error: error == const $CopyWithPlaceholder()
          ? _value.error
          // ignore: cast_nullable_to_non_nullable
          : error as String?,
      sentAt: sentAt == const $CopyWithPlaceholder()
          ? _value.sentAt
          // ignore: cast_nullable_to_non_nullable
          : sentAt as DateTime?,
      readAt: readAt == const $CopyWithPlaceholder()
          ? _value.readAt
          // ignore: cast_nullable_to_non_nullable
          : readAt as DateTime?,
    );
  }
}

extension $NotificationRecipientDtoCopyWith on NotificationRecipientDto {
  /// Returns a callable class that can be used as follows: `instanceOfNotificationRecipientDto.copyWith(...)` or like so:`instanceOfNotificationRecipientDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$NotificationRecipientDtoCWProxy get copyWith =>
      _$NotificationRecipientDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NotificationRecipientDto _$NotificationRecipientDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NotificationRecipientDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'userId',
      'fullName',
      'role',
      'status',
      'error',
      'sentAt',
      'readAt',
    ],
  );
  final val = NotificationRecipientDto(
    userId: $checkedConvert('userId', (v) => v as String),
    fullName: $checkedConvert('fullName', (v) => v as String),
    role: $checkedConvert(
      'role',
      (v) => $enumDecode(
        _$RoleEnumMap,
        v,
        unknownValue: Role.unknownDefaultOpenApi,
      ),
    ),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$NotificationDeliveryStatusEnumMap,
        v,
        unknownValue: NotificationDeliveryStatus.unknownDefaultOpenApi,
      ),
    ),
    error: $checkedConvert('error', (v) => v as String?),
    sentAt: $checkedConvert(
      'sentAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    readAt: $checkedConvert(
      'readAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$NotificationRecipientDtoToJson(
  NotificationRecipientDto instance,
) => <String, dynamic>{
  'userId': instance.userId,
  'fullName': instance.fullName,
  'role': _$RoleEnumMap[instance.role]!,
  'status': _$NotificationDeliveryStatusEnumMap[instance.status]!,
  'error': instance.error,
  'sentAt': instance.sentAt?.toIso8601String(),
  'readAt': instance.readAt?.toIso8601String(),
};

const _$RoleEnumMap = {
  Role.ADMIN: 'ADMIN',
  Role.COMMERCIAL: 'COMMERCIAL',
  Role.BANQUE_FINANCE: 'BANQUE_FINANCE',
  Role.SUPERVISEUR: 'SUPERVISEUR',
  Role.DIRECTION: 'DIRECTION',
  Role.ACCUEIL: 'ACCUEIL',
  Role.CHARGE_CLIENTELE: 'CHARGE_CLIENTELE',
  Role.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$NotificationDeliveryStatusEnumMap = {
  NotificationDeliveryStatus.PENDING: 'PENDING',
  NotificationDeliveryStatus.SENT: 'SENT',
  NotificationDeliveryStatus.DELIVERED: 'DELIVERED',
  NotificationDeliveryStatus.FAILED: 'FAILED',
  NotificationDeliveryStatus.READ: 'READ',
  NotificationDeliveryStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};
