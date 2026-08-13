// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_notification_template_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateNotificationTemplateDtoCWProxy {
  UpdateNotificationTemplateDto name(String? name);

  UpdateNotificationTemplateDto category(NotificationCategory? category);

  UpdateNotificationTemplateDto titleTemplate(String? titleTemplate);

  UpdateNotificationTemplateDto bodyTemplate(String? bodyTemplate);

  UpdateNotificationTemplateDto route(String? route);

  UpdateNotificationTemplateDto isActive(bool? isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateNotificationTemplateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateNotificationTemplateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateNotificationTemplateDto call({
    String? name,
    NotificationCategory? category,
    String? titleTemplate,
    String? bodyTemplate,
    String? route,
    bool? isActive,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateNotificationTemplateDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateNotificationTemplateDto.copyWith.fieldName(...)`
class _$UpdateNotificationTemplateDtoCWProxyImpl
    implements _$UpdateNotificationTemplateDtoCWProxy {
  const _$UpdateNotificationTemplateDtoCWProxyImpl(this._value);

  final UpdateNotificationTemplateDto _value;

  @override
  UpdateNotificationTemplateDto name(String? name) => this(name: name);

  @override
  UpdateNotificationTemplateDto category(NotificationCategory? category) =>
      this(category: category);

  @override
  UpdateNotificationTemplateDto titleTemplate(String? titleTemplate) =>
      this(titleTemplate: titleTemplate);

  @override
  UpdateNotificationTemplateDto bodyTemplate(String? bodyTemplate) =>
      this(bodyTemplate: bodyTemplate);

  @override
  UpdateNotificationTemplateDto route(String? route) => this(route: route);

  @override
  UpdateNotificationTemplateDto isActive(bool? isActive) =>
      this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateNotificationTemplateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateNotificationTemplateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateNotificationTemplateDto call({
    Object? name = const $CopyWithPlaceholder(),
    Object? category = const $CopyWithPlaceholder(),
    Object? titleTemplate = const $CopyWithPlaceholder(),
    Object? bodyTemplate = const $CopyWithPlaceholder(),
    Object? route = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return UpdateNotificationTemplateDto(
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String?,
      category: category == const $CopyWithPlaceholder()
          ? _value.category
          // ignore: cast_nullable_to_non_nullable
          : category as NotificationCategory?,
      titleTemplate: titleTemplate == const $CopyWithPlaceholder()
          ? _value.titleTemplate
          // ignore: cast_nullable_to_non_nullable
          : titleTemplate as String?,
      bodyTemplate: bodyTemplate == const $CopyWithPlaceholder()
          ? _value.bodyTemplate
          // ignore: cast_nullable_to_non_nullable
          : bodyTemplate as String?,
      route: route == const $CopyWithPlaceholder()
          ? _value.route
          // ignore: cast_nullable_to_non_nullable
          : route as String?,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool?,
    );
  }
}

extension $UpdateNotificationTemplateDtoCopyWith
    on UpdateNotificationTemplateDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateNotificationTemplateDto.copyWith(...)` or like so:`instanceOfUpdateNotificationTemplateDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateNotificationTemplateDtoCWProxy get copyWith =>
      _$UpdateNotificationTemplateDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateNotificationTemplateDto _$UpdateNotificationTemplateDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateNotificationTemplateDto', json, ($checkedConvert) {
  final val = UpdateNotificationTemplateDto(
    name: $checkedConvert('name', (v) => v as String?),
    category: $checkedConvert(
      'category',
      (v) => $enumDecodeNullable(
        _$NotificationCategoryEnumMap,
        v,
        unknownValue: NotificationCategory.unknownDefaultOpenApi,
      ),
    ),
    titleTemplate: $checkedConvert('titleTemplate', (v) => v as String?),
    bodyTemplate: $checkedConvert('bodyTemplate', (v) => v as String?),
    route: $checkedConvert('route', (v) => v as String?),
    isActive: $checkedConvert('isActive', (v) => v as bool?),
  );
  return val;
});

Map<String, dynamic> _$UpdateNotificationTemplateDtoToJson(
  UpdateNotificationTemplateDto instance,
) => <String, dynamic>{
  if (instance.name case final value?) 'name': value,
  if (_$NotificationCategoryEnumMap[instance.category] case final value?)
    'category': value,
  if (instance.titleTemplate case final value?) 'titleTemplate': value,
  if (instance.bodyTemplate case final value?) 'bodyTemplate': value,
  if (instance.route case final value?) 'route': value,
  if (instance.isActive case final value?) 'isActive': value,
};

const _$NotificationCategoryEnumMap = {
  NotificationCategory.ANNONCE: 'ANNONCE',
  NotificationCategory.RAPPEL: 'RAPPEL',
  NotificationCategory.CAMPAGNE: 'CAMPAGNE',
  NotificationCategory.DOSSIER: 'DOSSIER',
  NotificationCategory.SYSTEME: 'SYSTEME',
  NotificationCategory.unknownDefaultOpenApi: 'unknown_default_open_api',
};
