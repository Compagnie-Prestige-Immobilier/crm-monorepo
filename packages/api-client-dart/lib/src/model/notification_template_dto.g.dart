// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_template_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$NotificationTemplateDtoCWProxy {
  NotificationTemplateDto id(String id);

  NotificationTemplateDto name(String name);

  NotificationTemplateDto category(NotificationCategory category);

  NotificationTemplateDto titleTemplate(String titleTemplate);

  NotificationTemplateDto bodyTemplate(String bodyTemplate);

  NotificationTemplateDto route(String? route);

  NotificationTemplateDto variables(List<String> variables);

  NotificationTemplateDto isActive(bool isActive);

  NotificationTemplateDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationTemplateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationTemplateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationTemplateDto call({
    String id,
    String name,
    NotificationCategory category,
    String titleTemplate,
    String bodyTemplate,
    String? route,
    List<String> variables,
    bool isActive,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfNotificationTemplateDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfNotificationTemplateDto.copyWith.fieldName(...)`
class _$NotificationTemplateDtoCWProxyImpl
    implements _$NotificationTemplateDtoCWProxy {
  const _$NotificationTemplateDtoCWProxyImpl(this._value);

  final NotificationTemplateDto _value;

  @override
  NotificationTemplateDto id(String id) => this(id: id);

  @override
  NotificationTemplateDto name(String name) => this(name: name);

  @override
  NotificationTemplateDto category(NotificationCategory category) =>
      this(category: category);

  @override
  NotificationTemplateDto titleTemplate(String titleTemplate) =>
      this(titleTemplate: titleTemplate);

  @override
  NotificationTemplateDto bodyTemplate(String bodyTemplate) =>
      this(bodyTemplate: bodyTemplate);

  @override
  NotificationTemplateDto route(String? route) => this(route: route);

  @override
  NotificationTemplateDto variables(List<String> variables) =>
      this(variables: variables);

  @override
  NotificationTemplateDto isActive(bool isActive) => this(isActive: isActive);

  @override
  NotificationTemplateDto updatedAt(DateTime updatedAt) =>
      this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NotificationTemplateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NotificationTemplateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NotificationTemplateDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? category = const $CopyWithPlaceholder(),
    Object? titleTemplate = const $CopyWithPlaceholder(),
    Object? bodyTemplate = const $CopyWithPlaceholder(),
    Object? route = const $CopyWithPlaceholder(),
    Object? variables = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return NotificationTemplateDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      category: category == const $CopyWithPlaceholder()
          ? _value.category
          // ignore: cast_nullable_to_non_nullable
          : category as NotificationCategory,
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
      variables: variables == const $CopyWithPlaceholder()
          ? _value.variables
          // ignore: cast_nullable_to_non_nullable
          : variables as List<String>,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
    );
  }
}

extension $NotificationTemplateDtoCopyWith on NotificationTemplateDto {
  /// Returns a callable class that can be used as follows: `instanceOfNotificationTemplateDto.copyWith(...)` or like so:`instanceOfNotificationTemplateDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$NotificationTemplateDtoCWProxy get copyWith =>
      _$NotificationTemplateDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NotificationTemplateDto _$NotificationTemplateDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NotificationTemplateDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'name',
      'category',
      'titleTemplate',
      'bodyTemplate',
      'route',
      'variables',
      'isActive',
      'updatedAt',
    ],
  );
  final val = NotificationTemplateDto(
    id: $checkedConvert('id', (v) => v as String),
    name: $checkedConvert('name', (v) => v as String),
    category: $checkedConvert(
      'category',
      (v) => $enumDecode(
        _$NotificationCategoryEnumMap,
        v,
        unknownValue: NotificationCategory.unknownDefaultOpenApi,
      ),
    ),
    titleTemplate: $checkedConvert('titleTemplate', (v) => v as String),
    bodyTemplate: $checkedConvert('bodyTemplate', (v) => v as String),
    route: $checkedConvert('route', (v) => v as String?),
    variables: $checkedConvert(
      'variables',
      (v) => (v as List<dynamic>).map((e) => e as String).toList(),
    ),
    isActive: $checkedConvert('isActive', (v) => v as bool),
    updatedAt: $checkedConvert('updatedAt', (v) => DateTime.parse(v as String)),
  );
  return val;
});

Map<String, dynamic> _$NotificationTemplateDtoToJson(
  NotificationTemplateDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'category': _$NotificationCategoryEnumMap[instance.category]!,
  'titleTemplate': instance.titleTemplate,
  'bodyTemplate': instance.bodyTemplate,
  'route': instance.route,
  'variables': instance.variables,
  'isActive': instance.isActive,
  'updatedAt': instance.updatedAt.toIso8601String(),
};

const _$NotificationCategoryEnumMap = {
  NotificationCategory.ANNONCE: 'ANNONCE',
  NotificationCategory.RAPPEL: 'RAPPEL',
  NotificationCategory.CAMPAGNE: 'CAMPAGNE',
  NotificationCategory.DOSSIER: 'DOSSIER',
  NotificationCategory.SYSTEME: 'SYSTEME',
  NotificationCategory.unknownDefaultOpenApi: 'unknown_default_open_api',
};
