// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$NotificationDtoCWProxy {
  NotificationDto id(String id);

  NotificationDto title(String title);

  NotificationDto body(String body);

  NotificationDto category(NotificationCategory category);

  NotificationDto route(String? route);

  NotificationDto audience(NotificationAudience audience);

  NotificationDto audienceRole(Role? audienceRole);

  NotificationDto audienceUserIds(List<String> audienceUserIds);

  NotificationDto status(NotificationStatus status);

  NotificationDto scheduledFor(DateTime? scheduledFor);

  NotificationDto sentAt(DateTime? sentAt);

  NotificationDto cancelledAt(DateTime? cancelledAt);

  NotificationDto transportStatus(String? transportStatus);

  NotificationDto createdByName(String? createdByName);

  NotificationDto createdAt(DateTime createdAt);

  NotificationDto counts(NotificationDeliveryCountsDto counts);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationDto call({
    String id,
    String title,
    String body,
    NotificationCategory category,
    String? route,
    NotificationAudience audience,
    Role? audienceRole,
    List<String> audienceUserIds,
    NotificationStatus status,
    DateTime? scheduledFor,
    DateTime? sentAt,
    DateTime? cancelledAt,
    String? transportStatus,
    String? createdByName,
    DateTime createdAt,
    NotificationDeliveryCountsDto counts,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfNotificationDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfNotificationDto.copyWith.fieldName(...)`
class _$NotificationDtoCWProxyImpl implements _$NotificationDtoCWProxy {
  const _$NotificationDtoCWProxyImpl(this._value);

  final NotificationDto _value;

  @override
  NotificationDto id(String id) => this(id: id);

  @override
  NotificationDto title(String title) => this(title: title);

  @override
  NotificationDto body(String body) => this(body: body);

  @override
  NotificationDto category(NotificationCategory category) =>
      this(category: category);

  @override
  NotificationDto route(String? route) => this(route: route);

  @override
  NotificationDto audience(NotificationAudience audience) =>
      this(audience: audience);

  @override
  NotificationDto audienceRole(Role? audienceRole) =>
      this(audienceRole: audienceRole);

  @override
  NotificationDto audienceUserIds(List<String> audienceUserIds) =>
      this(audienceUserIds: audienceUserIds);

  @override
  NotificationDto status(NotificationStatus status) => this(status: status);

  @override
  NotificationDto scheduledFor(DateTime? scheduledFor) =>
      this(scheduledFor: scheduledFor);

  @override
  NotificationDto sentAt(DateTime? sentAt) => this(sentAt: sentAt);

  @override
  NotificationDto cancelledAt(DateTime? cancelledAt) =>
      this(cancelledAt: cancelledAt);

  @override
  NotificationDto transportStatus(String? transportStatus) =>
      this(transportStatus: transportStatus);

  @override
  NotificationDto createdByName(String? createdByName) =>
      this(createdByName: createdByName);

  @override
  NotificationDto createdAt(DateTime createdAt) => this(createdAt: createdAt);

  @override
  NotificationDto counts(NotificationDeliveryCountsDto counts) =>
      this(counts: counts);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? title = const $CopyWithPlaceholder(),
    Object? body = const $CopyWithPlaceholder(),
    Object? category = const $CopyWithPlaceholder(),
    Object? route = const $CopyWithPlaceholder(),
    Object? audience = const $CopyWithPlaceholder(),
    Object? audienceRole = const $CopyWithPlaceholder(),
    Object? audienceUserIds = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? scheduledFor = const $CopyWithPlaceholder(),
    Object? sentAt = const $CopyWithPlaceholder(),
    Object? cancelledAt = const $CopyWithPlaceholder(),
    Object? transportStatus = const $CopyWithPlaceholder(),
    Object? createdByName = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? counts = const $CopyWithPlaceholder(),
  }) {
    return NotificationDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      title: title == const $CopyWithPlaceholder()
          ? _value.title
          // ignore: cast_nullable_to_non_nullable
          : title as String,
      body: body == const $CopyWithPlaceholder()
          ? _value.body
          // ignore: cast_nullable_to_non_nullable
          : body as String,
      category: category == const $CopyWithPlaceholder()
          ? _value.category
          // ignore: cast_nullable_to_non_nullable
          : category as NotificationCategory,
      route: route == const $CopyWithPlaceholder()
          ? _value.route
          // ignore: cast_nullable_to_non_nullable
          : route as String?,
      audience: audience == const $CopyWithPlaceholder()
          ? _value.audience
          // ignore: cast_nullable_to_non_nullable
          : audience as NotificationAudience,
      audienceRole: audienceRole == const $CopyWithPlaceholder()
          ? _value.audienceRole
          // ignore: cast_nullable_to_non_nullable
          : audienceRole as Role?,
      audienceUserIds: audienceUserIds == const $CopyWithPlaceholder()
          ? _value.audienceUserIds
          // ignore: cast_nullable_to_non_nullable
          : audienceUserIds as List<String>,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as NotificationStatus,
      scheduledFor: scheduledFor == const $CopyWithPlaceholder()
          ? _value.scheduledFor
          // ignore: cast_nullable_to_non_nullable
          : scheduledFor as DateTime?,
      sentAt: sentAt == const $CopyWithPlaceholder()
          ? _value.sentAt
          // ignore: cast_nullable_to_non_nullable
          : sentAt as DateTime?,
      cancelledAt: cancelledAt == const $CopyWithPlaceholder()
          ? _value.cancelledAt
          // ignore: cast_nullable_to_non_nullable
          : cancelledAt as DateTime?,
      transportStatus: transportStatus == const $CopyWithPlaceholder()
          ? _value.transportStatus
          // ignore: cast_nullable_to_non_nullable
          : transportStatus as String?,
      createdByName: createdByName == const $CopyWithPlaceholder()
          ? _value.createdByName
          // ignore: cast_nullable_to_non_nullable
          : createdByName as String?,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
      counts: counts == const $CopyWithPlaceholder()
          ? _value.counts
          // ignore: cast_nullable_to_non_nullable
          : counts as NotificationDeliveryCountsDto,
    );
  }
}

extension $NotificationDtoCopyWith on NotificationDto {
  /// Returns a callable class that can be used as follows: `instanceOfNotificationDto.copyWith(...)` or like so:`instanceOfNotificationDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$NotificationDtoCWProxy get copyWith => _$NotificationDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NotificationDto _$NotificationDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NotificationDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'title',
      'body',
      'category',
      'route',
      'audience',
      'audienceRole',
      'audienceUserIds',
      'status',
      'scheduledFor',
      'sentAt',
      'cancelledAt',
      'transportStatus',
      'createdByName',
      'createdAt',
      'counts',
    ],
  );
  final val = NotificationDto(
    id: $checkedConvert('id', (v) => v as String),
    title: $checkedConvert('title', (v) => v as String),
    body: $checkedConvert('body', (v) => v as String),
    category: $checkedConvert(
      'category',
      (v) => $enumDecode(
        _$NotificationCategoryEnumMap,
        v,
        unknownValue: NotificationCategory.unknownDefaultOpenApi,
      ),
    ),
    route: $checkedConvert('route', (v) => v as String?),
    audience: $checkedConvert(
      'audience',
      (v) => $enumDecode(
        _$NotificationAudienceEnumMap,
        v,
        unknownValue: NotificationAudience.unknownDefaultOpenApi,
      ),
    ),
    audienceRole: $checkedConvert(
      'audienceRole',
      (v) => $enumDecodeNullable(
        _$RoleEnumMap,
        v,
        unknownValue: Role.unknownDefaultOpenApi,
      ),
    ),
    audienceUserIds: $checkedConvert(
      'audienceUserIds',
      (v) => (v as List<dynamic>).map((e) => e as String).toList(),
    ),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$NotificationStatusEnumMap,
        v,
        unknownValue: NotificationStatus.unknownDefaultOpenApi,
      ),
    ),
    scheduledFor: $checkedConvert(
      'scheduledFor',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    sentAt: $checkedConvert(
      'sentAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    cancelledAt: $checkedConvert(
      'cancelledAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    transportStatus: $checkedConvert('transportStatus', (v) => v as String?),
    createdByName: $checkedConvert('createdByName', (v) => v as String?),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
    counts: $checkedConvert(
      'counts',
      (v) => NotificationDeliveryCountsDto.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$NotificationDtoToJson(NotificationDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'body': instance.body,
      'category': _$NotificationCategoryEnumMap[instance.category]!,
      'route': instance.route,
      'audience': _$NotificationAudienceEnumMap[instance.audience]!,
      'audienceRole': _$RoleEnumMap[instance.audienceRole],
      'audienceUserIds': instance.audienceUserIds,
      'status': _$NotificationStatusEnumMap[instance.status]!,
      'scheduledFor': instance.scheduledFor?.toIso8601String(),
      'sentAt': instance.sentAt?.toIso8601String(),
      'cancelledAt': instance.cancelledAt?.toIso8601String(),
      'transportStatus': instance.transportStatus,
      'createdByName': instance.createdByName,
      'createdAt': instance.createdAt.toIso8601String(),
      'counts': instance.counts.toJson(),
    };

const _$NotificationCategoryEnumMap = {
  NotificationCategory.ANNONCE: 'ANNONCE',
  NotificationCategory.RAPPEL: 'RAPPEL',
  NotificationCategory.CAMPAGNE: 'CAMPAGNE',
  NotificationCategory.DOSSIER: 'DOSSIER',
  NotificationCategory.SYSTEME: 'SYSTEME',
  NotificationCategory.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$NotificationAudienceEnumMap = {
  NotificationAudience.ALL: 'ALL',
  NotificationAudience.ROLE: 'ROLE',
  NotificationAudience.DEPARTEMENT: 'DEPARTEMENT',
  NotificationAudience.USERS: 'USERS',
  NotificationAudience.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$RoleEnumMap = {
  Role.ADMIN: 'ADMIN',
  Role.COMMERCIAL: 'COMMERCIAL',
  Role.BANQUE_FINANCE: 'BANQUE_FINANCE',
  Role.SUPERVISEUR: 'SUPERVISEUR',
  Role.DIRECTION: 'DIRECTION',
  Role.ACCUEIL: 'ACCUEIL',
  Role.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$NotificationStatusEnumMap = {
  NotificationStatus.SCHEDULED: 'SCHEDULED',
  NotificationStatus.SENDING: 'SENDING',
  NotificationStatus.SENT: 'SENT',
  NotificationStatus.CANCELLED: 'CANCELLED',
  NotificationStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};
