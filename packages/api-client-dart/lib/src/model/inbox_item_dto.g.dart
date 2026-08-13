// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'inbox_item_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$InboxItemDtoCWProxy {
  InboxItemDto id(String id);

  InboxItemDto notificationId(String notificationId);

  InboxItemDto title(String title);

  InboxItemDto body(String body);

  InboxItemDto category(NotificationCategory category);

  InboxItemDto route(String? route);

  InboxItemDto isRead(bool isRead);

  InboxItemDto readAt(DateTime? readAt);

  InboxItemDto createdAt(DateTime createdAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `InboxItemDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// InboxItemDto(...).copyWith(id: 12, name: "My name")
  /// ````
  InboxItemDto call({
    String id,
    String notificationId,
    String title,
    String body,
    NotificationCategory category,
    String? route,
    bool isRead,
    DateTime? readAt,
    DateTime createdAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfInboxItemDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfInboxItemDto.copyWith.fieldName(...)`
class _$InboxItemDtoCWProxyImpl implements _$InboxItemDtoCWProxy {
  const _$InboxItemDtoCWProxyImpl(this._value);

  final InboxItemDto _value;

  @override
  InboxItemDto id(String id) => this(id: id);

  @override
  InboxItemDto notificationId(String notificationId) =>
      this(notificationId: notificationId);

  @override
  InboxItemDto title(String title) => this(title: title);

  @override
  InboxItemDto body(String body) => this(body: body);

  @override
  InboxItemDto category(NotificationCategory category) =>
      this(category: category);

  @override
  InboxItemDto route(String? route) => this(route: route);

  @override
  InboxItemDto isRead(bool isRead) => this(isRead: isRead);

  @override
  InboxItemDto readAt(DateTime? readAt) => this(readAt: readAt);

  @override
  InboxItemDto createdAt(DateTime createdAt) => this(createdAt: createdAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `InboxItemDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// InboxItemDto(...).copyWith(id: 12, name: "My name")
  /// ````
  InboxItemDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? notificationId = const $CopyWithPlaceholder(),
    Object? title = const $CopyWithPlaceholder(),
    Object? body = const $CopyWithPlaceholder(),
    Object? category = const $CopyWithPlaceholder(),
    Object? route = const $CopyWithPlaceholder(),
    Object? isRead = const $CopyWithPlaceholder(),
    Object? readAt = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
  }) {
    return InboxItemDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      notificationId: notificationId == const $CopyWithPlaceholder()
          ? _value.notificationId
          // ignore: cast_nullable_to_non_nullable
          : notificationId as String,
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
      isRead: isRead == const $CopyWithPlaceholder()
          ? _value.isRead
          // ignore: cast_nullable_to_non_nullable
          : isRead as bool,
      readAt: readAt == const $CopyWithPlaceholder()
          ? _value.readAt
          // ignore: cast_nullable_to_non_nullable
          : readAt as DateTime?,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
    );
  }
}

extension $InboxItemDtoCopyWith on InboxItemDto {
  /// Returns a callable class that can be used as follows: `instanceOfInboxItemDto.copyWith(...)` or like so:`instanceOfInboxItemDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$InboxItemDtoCWProxy get copyWith => _$InboxItemDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InboxItemDto _$InboxItemDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('InboxItemDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'notificationId',
          'title',
          'body',
          'category',
          'route',
          'isRead',
          'readAt',
          'createdAt',
        ],
      );
      final val = InboxItemDto(
        id: $checkedConvert('id', (v) => v as String),
        notificationId: $checkedConvert('notificationId', (v) => v as String),
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
        isRead: $checkedConvert('isRead', (v) => v as bool),
        readAt: $checkedConvert(
          'readAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        createdAt: $checkedConvert(
          'createdAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$InboxItemDtoToJson(InboxItemDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'notificationId': instance.notificationId,
      'title': instance.title,
      'body': instance.body,
      'category': _$NotificationCategoryEnumMap[instance.category]!,
      'route': instance.route,
      'isRead': instance.isRead,
      'readAt': instance.readAt?.toIso8601String(),
      'createdAt': instance.createdAt.toIso8601String(),
    };

const _$NotificationCategoryEnumMap = {
  NotificationCategory.ANNONCE: 'ANNONCE',
  NotificationCategory.RAPPEL: 'RAPPEL',
  NotificationCategory.CAMPAGNE: 'CAMPAGNE',
  NotificationCategory.DOSSIER: 'DOSSIER',
  NotificationCategory.SYSTEME: 'SYSTEME',
  NotificationCategory.unknownDefaultOpenApi: 'unknown_default_open_api',
};
