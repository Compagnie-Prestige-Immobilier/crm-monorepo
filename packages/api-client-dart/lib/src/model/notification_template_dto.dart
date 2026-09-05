//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/notification_category.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'notification_template_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NotificationTemplateDto {
  /// Returns a new [NotificationTemplateDto] instance.
  NotificationTemplateDto({
    required this.id,

    required this.name,

    required this.category,

    required this.titleTemplate,

    required this.bodyTemplate,

    required this.route,

    required this.variables,

    required this.isActive,

    required this.updatedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(
    name: r'category',
    required: true,
    includeIfNull: false,
    unknownEnumValue: NotificationCategory.unknownDefaultOpenApi,
  )
  final NotificationCategory category;

  @JsonKey(name: r'titleTemplate', required: true, includeIfNull: false)
  final String titleTemplate;

  @JsonKey(name: r'bodyTemplate', required: true, includeIfNull: false)
  final String bodyTemplate;

  @JsonKey(name: r'route', required: true, includeIfNull: true)
  final String? route;

  /// Variables citées par le gabarit, recalculées à chaque écriture.
  @JsonKey(name: r'variables', required: true, includeIfNull: false)
  final List<String> variables;

  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is NotificationTemplateDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                name,
                category,
                titleTemplate,
                bodyTemplate,
                route,
                variables,
                isActive,
                updatedAt,
              ],
              [
                other.id,
                other.name,
                other.category,
                other.titleTemplate,
                other.bodyTemplate,
                other.route,
                other.variables,
                other.isActive,
                other.updatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        name,
        category,
        titleTemplate,
        bodyTemplate,
        route,
        variables,
        isActive,
        updatedAt,
      ]);

  factory NotificationTemplateDto.fromJson(Map<String, dynamic> json) =>
      _$NotificationTemplateDtoFromJson(json);

  Map<String, dynamic> toJson() => _$NotificationTemplateDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
