//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/notification_category.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_notification_template_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateNotificationTemplateDto {
  /// Returns a new [UpdateNotificationTemplateDto] instance.
  UpdateNotificationTemplateDto({

     this.name,

     this.category,

     this.titleTemplate,

     this.bodyTemplate,

     this.route,

     this.isActive,
  });

  @JsonKey(
    
    name: r'name',
    required: false,
    includeIfNull: false,
  )


  final String? name;



  @JsonKey(
    
    name: r'category',
    required: false,
    includeIfNull: false,
  unknownEnumValue: NotificationCategory.unknownDefaultOpenApi,
  )


  final NotificationCategory? category;



  @JsonKey(
    
    name: r'titleTemplate',
    required: false,
    includeIfNull: false,
  )


  final String? titleTemplate;



  @JsonKey(
    
    name: r'bodyTemplate',
    required: false,
    includeIfNull: false,
  )


  final String? bodyTemplate;



      /// Chaîne vide pour retirer le lien.
  @JsonKey(
    
    name: r'route',
    required: false,
    includeIfNull: false,
  )


  final String? route;



  @JsonKey(
    
    name: r'isActive',
    required: false,
    includeIfNull: false,
  )


  final bool? isActive;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is UpdateNotificationTemplateDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            name,
            category,
            titleTemplate,
            bodyTemplate,
            route,
            isActive,
        ],
        [
            other.name,
            other.category,
            other.titleTemplate,
            other.bodyTemplate,
            other.route,
            other.isActive,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        name,
        category,
        titleTemplate,
        bodyTemplate,
        route,
        isActive,
    ],);

  factory UpdateNotificationTemplateDto.fromJson(Map<String, dynamic> json) => _$UpdateNotificationTemplateDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateNotificationTemplateDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

