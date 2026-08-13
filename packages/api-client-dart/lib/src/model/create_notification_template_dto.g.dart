// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_notification_template_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateNotificationTemplateDtoCWProxy {
  CreateNotificationTemplateDto name(String name);

  CreateNotificationTemplateDto category(NotificationCategory? category);

  CreateNotificationTemplateDto titleTemplate(String titleTemplate);

  CreateNotificationTemplateDto bodyTemplate(String bodyTemplate);

  CreateNotificationTemplateDto route(String? route);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateNotificationTemplateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateNotificationTemplateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateNotificationTemplateDto call({
    String name,
    NotificationCategory? category,
    String titleTemplate,
    String bodyTemplate,
    String? route,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateNotificationTemplateDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateNotificationTemplateDto.copyWith.fieldName(...)`
class _$CreateNotificationTemplateDtoCWProxyImpl
    implements _$CreateNotificationTemplateDtoCWProxy {
  const _$CreateNotificationTemplateDtoCWProxyImpl(this._value);

  final CreateNotificationTemplateDto _value;

  @override
  CreateNotificationTemplateDto name(String name) => this(name: name);

  @override
  CreateNotificationTemplateDto category(NotificationCategory? category) =>
      this(category: category);

  @override
  CreateNotificationTemplateDto titleTemplate(String titleTemplate) =>
      this(titleTemplate: titleTemplate);

  @override
  CreateNotificationTemplateDto bodyTemplate(String bodyTemplate) =>
      this(bodyTemplate: bodyTemplate);

  @override
  CreateNotificationTemplateDto route(String? route) => this(route: route);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateNotificationTemplateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateNotificationTemplateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateNotificationTemplateDto call({
    Object? name = const $CopyWithPlaceholder(),
    Object? category = const $CopyWithPlaceholder(),
    Object? titleTemplate = const $CopyWithPlaceholder(),
    Object? bodyTemplate = const $CopyWithPlaceholder(),
    Object? route = const $CopyWithPlaceholder(),
  }) {
    return CreateNotificationTemplateDto(
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      category: category == const $CopyWithPlaceholder()
          ? _value.category
          // ignore: cast_nullable_to_non_nullable
          : category as NotificationCategory?,
      titleTemplate: titleTemplate == const $CopyWithPlaceholder()
          ? _value.titleTemplate
          // ignore: cast_nullable_to_non_nullable
          : titleTemplate as String,
      bodyTemplate: bodyTemplate == const $CopyWithPlaceholder()
          ? _value.bodyTemplate
          // ignore: cast_nullable_to_non_nullable
          : bodyTemplate as String,
      route: route == const $CopyWithPlaceholder()
          ? _value.route
          // ignore: cast_nullable_to_non_nullable
          : route as String?,
    );
  }
}

extension $CreateNotificationTemplateDtoCopyWith
    on CreateNotificationTemplateDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateNotificationTemplateDto.copyWith(...)` or like so:`instanceOfCreateNotificationTemplateDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateNotificationTemplateDtoCWProxy get copyWith =>
      _$CreateNotificationTemplateDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateNotificationTemplateDto _$CreateNotificationTemplateDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateNotificationTemplateDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['name', 'titleTemplate', 'bodyTemplate'],
  );
  final val = CreateNotificationTemplateDto(
    name: $checkedConvert('name', (v) => v as String),
    category: $checkedConvert(
      'category',
      (v) => $enumDecodeNullable(
        _$NotificationCategoryEnumMap,
        v,
        unknownValue: NotificationCategory.unknownDefaultOpenApi,
      ),
    ),
    titleTemplate: $checkedConvert('titleTemplate', (v) => v as String),
    bodyTemplate: $checkedConvert('bodyTemplate', (v) => v as String),
    route: $checkedConvert('route', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$CreateNotificationTemplateDtoToJson(
  CreateNotificationTemplateDto instance,
) => <String, dynamic>{
  'name': instance.name,
  if (_$NotificationCategoryEnumMap[instance.category] case final value?)
    'category': value,
  'titleTemplate': instance.titleTemplate,
  'bodyTemplate': instance.bodyTemplate,
  if (instance.route case final value?) 'route': value,
};

const _$NotificationCategoryEnumMap = {
  NotificationCategory.ANNONCE: 'ANNONCE',
  NotificationCategory.RAPPEL: 'RAPPEL',
  NotificationCategory.CAMPAGNE: 'CAMPAGNE',
  NotificationCategory.DOSSIER: 'DOSSIER',
  NotificationCategory.SYSTEME: 'SYSTEME',
  NotificationCategory.unknownDefaultOpenApi: 'unknown_default_open_api',
};
