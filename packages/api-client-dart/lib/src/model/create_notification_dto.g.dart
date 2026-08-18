// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_notification_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateNotificationDtoCWProxy {
  CreateNotificationDto title(String title);

  CreateNotificationDto body(String body);

  CreateNotificationDto category(NotificationCategory? category);

  CreateNotificationDto route(String? route);

  CreateNotificationDto audience(NotificationAudience audience);

  CreateNotificationDto audienceRole(Role? audienceRole);

  CreateNotificationDto audienceDepartementId(String? audienceDepartementId);

  CreateNotificationDto audienceUserIds(List<String>? audienceUserIds);

  CreateNotificationDto scheduledFor(DateTime? scheduledFor);

  CreateNotificationDto templateId(String? templateId);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateNotificationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateNotificationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateNotificationDto call({
    String title,
    String body,
    NotificationCategory? category,
    String? route,
    NotificationAudience audience,
    Role? audienceRole,
    String? audienceDepartementId,
    List<String>? audienceUserIds,
    DateTime? scheduledFor,
    String? templateId,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateNotificationDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateNotificationDto.copyWith.fieldName(...)`
class _$CreateNotificationDtoCWProxyImpl
    implements _$CreateNotificationDtoCWProxy {
  const _$CreateNotificationDtoCWProxyImpl(this._value);

  final CreateNotificationDto _value;

  @override
  CreateNotificationDto title(String title) => this(title: title);

  @override
  CreateNotificationDto body(String body) => this(body: body);

  @override
  CreateNotificationDto category(NotificationCategory? category) =>
      this(category: category);

  @override
  CreateNotificationDto route(String? route) => this(route: route);

  @override
  CreateNotificationDto audience(NotificationAudience audience) =>
      this(audience: audience);

  @override
  CreateNotificationDto audienceRole(Role? audienceRole) =>
      this(audienceRole: audienceRole);

  @override
  CreateNotificationDto audienceDepartementId(String? audienceDepartementId) =>
      this(audienceDepartementId: audienceDepartementId);

  @override
  CreateNotificationDto audienceUserIds(List<String>? audienceUserIds) =>
      this(audienceUserIds: audienceUserIds);

  @override
  CreateNotificationDto scheduledFor(DateTime? scheduledFor) =>
      this(scheduledFor: scheduledFor);

  @override
  CreateNotificationDto templateId(String? templateId) =>
      this(templateId: templateId);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateNotificationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateNotificationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateNotificationDto call({
    Object? title = const $CopyWithPlaceholder(),
    Object? body = const $CopyWithPlaceholder(),
    Object? category = const $CopyWithPlaceholder(),
    Object? route = const $CopyWithPlaceholder(),
    Object? audience = const $CopyWithPlaceholder(),
    Object? audienceRole = const $CopyWithPlaceholder(),
    Object? audienceDepartementId = const $CopyWithPlaceholder(),
    Object? audienceUserIds = const $CopyWithPlaceholder(),
    Object? scheduledFor = const $CopyWithPlaceholder(),
    Object? templateId = const $CopyWithPlaceholder(),
  }) {
    return CreateNotificationDto(
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
          : category as NotificationCategory?,
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
      audienceDepartementId:
          audienceDepartementId == const $CopyWithPlaceholder()
          ? _value.audienceDepartementId
          // ignore: cast_nullable_to_non_nullable
          : audienceDepartementId as String?,
      audienceUserIds: audienceUserIds == const $CopyWithPlaceholder()
          ? _value.audienceUserIds
          // ignore: cast_nullable_to_non_nullable
          : audienceUserIds as List<String>?,
      scheduledFor: scheduledFor == const $CopyWithPlaceholder()
          ? _value.scheduledFor
          // ignore: cast_nullable_to_non_nullable
          : scheduledFor as DateTime?,
      templateId: templateId == const $CopyWithPlaceholder()
          ? _value.templateId
          // ignore: cast_nullable_to_non_nullable
          : templateId as String?,
    );
  }
}

extension $CreateNotificationDtoCopyWith on CreateNotificationDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateNotificationDto.copyWith(...)` or like so:`instanceOfCreateNotificationDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateNotificationDtoCWProxy get copyWith =>
      _$CreateNotificationDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateNotificationDto _$CreateNotificationDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateNotificationDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['title', 'body', 'audience']);
  final val = CreateNotificationDto(
    title: $checkedConvert('title', (v) => v as String),
    body: $checkedConvert('body', (v) => v as String),
    category: $checkedConvert(
      'category',
      (v) => $enumDecodeNullable(
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
    audienceDepartementId: $checkedConvert(
      'audienceDepartementId',
      (v) => v as String?,
    ),
    audienceUserIds: $checkedConvert(
      'audienceUserIds',
      (v) => (v as List<dynamic>?)?.map((e) => e as String).toList(),
    ),
    scheduledFor: $checkedConvert(
      'scheduledFor',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    templateId: $checkedConvert('templateId', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$CreateNotificationDtoToJson(
  CreateNotificationDto instance,
) => <String, dynamic>{
  'title': instance.title,
  'body': instance.body,
  if (_$NotificationCategoryEnumMap[instance.category] case final value?)
    'category': value,
  if (instance.route case final value?) 'route': value,
  'audience': _$NotificationAudienceEnumMap[instance.audience]!,
  if (_$RoleEnumMap[instance.audienceRole] case final value?)
    'audienceRole': value,
  if (instance.audienceDepartementId case final value?)
    'audienceDepartementId': value,
  if (instance.audienceUserIds case final value?) 'audienceUserIds': value,
  if (instance.scheduledFor?.toIso8601String() case final value?)
    'scheduledFor': value,
  if (instance.templateId case final value?) 'templateId': value,
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
  Role.unknownDefaultOpenApi: 'unknown_default_open_api',
};
