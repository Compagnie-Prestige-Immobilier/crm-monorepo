//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/notification_category.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_notification_template_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateNotificationTemplateDto {
  /// Returns a new [CreateNotificationTemplateDto] instance.
  CreateNotificationTemplateDto({
    required this.name,

    this.category,

    required this.titleTemplate,

    required this.bodyTemplate,

    this.route,
  });

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(
    name: r'category',
    required: false,
    includeIfNull: false,
    unknownEnumValue: NotificationCategory.unknownDefaultOpenApi,
  )
  final NotificationCategory? category;

  /// Peut contenir des `{{variables}}`.
  @JsonKey(name: r'titleTemplate', required: true, includeIfNull: false)
  final String titleTemplate;

  @JsonKey(name: r'bodyTemplate', required: true, includeIfNull: false)
  final String bodyTemplate;

  @JsonKey(name: r'route', required: false, includeIfNull: false)
  final String? route;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateNotificationTemplateDto &&
            runtimeType == other.runtimeType &&
            equals(
              [name, category, titleTemplate, bodyTemplate, route],
              [
                other.name,
                other.category,
                other.titleTemplate,
                other.bodyTemplate,
                other.route,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([name, category, titleTemplate, bodyTemplate, route]);

  factory CreateNotificationTemplateDto.fromJson(Map<String, dynamic> json) =>
      _$CreateNotificationTemplateDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateNotificationTemplateDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
