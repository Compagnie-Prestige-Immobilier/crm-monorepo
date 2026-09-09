//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/notification_category.dart';
import 'package:crm_api_client/src/model/notification_audience.dart';
import 'package:crm_api_client/src/model/role.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_notification_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateNotificationDto {
  /// Returns a new [CreateNotificationDto] instance.
  CreateNotificationDto({
    required this.title,

    required this.body,

    this.category,

    this.route,

    required this.audience,

    this.audienceRole,

    this.audienceUserIds,

    this.scheduledFor,

    this.templateId,
  });

  @JsonKey(name: r'title', required: true, includeIfNull: false)
  final String title;

  /// Android tronque au-delà de quatre lignes environ ; 500 est un plafond de stockage, pas une cible de rédaction.
  @JsonKey(name: r'body', required: true, includeIfNull: false)
  final String body;

  @JsonKey(
    name: r'category',
    required: false,
    includeIfNull: false,
    unknownEnumValue: NotificationCategory.unknownDefaultOpenApi,
  )
  final NotificationCategory? category;

  /// Route interne, ex. `/phase2`. Une URL absolue est refusée.
  @JsonKey(name: r'route', required: false, includeIfNull: false)
  final String? route;

  @JsonKey(
    name: r'audience',
    required: true,
    includeIfNull: false,
    unknownEnumValue: NotificationAudience.unknownDefaultOpenApi,
  )
  final NotificationAudience audience;

  @JsonKey(
    name: r'audienceRole',
    required: false,
    includeIfNull: false,
    unknownEnumValue: Role.unknownDefaultOpenApi,
  )
  final Role? audienceRole;

  @JsonKey(name: r'audienceUserIds', required: false, includeIfNull: false)
  final List<String>? audienceUserIds;

  /// Absent ou passé : envoi immédiat refusé si passé, envoi immédiat si absent.
  @JsonKey(name: r'scheduledFor', required: false, includeIfNull: false)
  final DateTime? scheduledFor;

  /// Gabarit d’origine, pour la traçabilité.
  @JsonKey(name: r'templateId', required: false, includeIfNull: false)
  final String? templateId;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateNotificationDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                title,
                body,
                category,
                route,
                audience,
                audienceRole,
                audienceUserIds,
                scheduledFor,
                templateId,
              ],
              [
                other.title,
                other.body,
                other.category,
                other.route,
                other.audience,
                other.audienceRole,
                other.audienceUserIds,
                other.scheduledFor,
                other.templateId,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        title,
        body,
        category,
        route,
        audience,
        audienceRole,
        audienceUserIds,
        scheduledFor,
        templateId,
      ]);

  factory CreateNotificationDto.fromJson(Map<String, dynamic> json) =>
      _$CreateNotificationDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateNotificationDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
