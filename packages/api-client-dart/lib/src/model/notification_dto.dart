//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/notification_delivery_counts_dto.dart';
import 'package:crm_api_client/src/model/notification_status.dart';
import 'package:crm_api_client/src/model/notification_category.dart';
import 'package:crm_api_client/src/model/notification_audience.dart';
import 'package:crm_api_client/src/model/role.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'notification_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NotificationDto {
  /// Returns a new [NotificationDto] instance.
  NotificationDto({

    required  this.id,

    required  this.title,

    required  this.body,

    required  this.category,

    required  this.route,

    required  this.audience,

    required  this.audienceRole,

    required  this.audienceUserIds,

    required  this.status,

    required  this.scheduledFor,

    required  this.sentAt,

    required  this.cancelledAt,

    required  this.transportStatus,

    required  this.createdByName,

    required  this.createdAt,

    required  this.counts,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'title',
    required: true,
    includeIfNull: false,
  )


  final String title;



  @JsonKey(
    
    name: r'body',
    required: true,
    includeIfNull: false,
  )


  final String body;



  @JsonKey(
    
    name: r'category',
    required: true,
    includeIfNull: false,
  unknownEnumValue: NotificationCategory.unknownDefaultOpenApi,
  )


  final NotificationCategory category;



      /// Route interne ouverte au tap, ex. `/phase2`. Jamais une URL absolue.
  @JsonKey(
    
    name: r'route',
    required: true,
    includeIfNull: true,
  )


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
    required: true,
    includeIfNull: true,
  unknownEnumValue: Role.unknownDefaultOpenApi,
  )


  final Role? audienceRole;



  @JsonKey(
    
    name: r'audienceUserIds',
    required: true,
    includeIfNull: false,
  )


  final List<String> audienceUserIds;



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  unknownEnumValue: NotificationStatus.unknownDefaultOpenApi,
  )


  final NotificationStatus status;



  @JsonKey(
    
    name: r'scheduledFor',
    required: true,
    includeIfNull: true,
  )


  final DateTime? scheduledFor;



  @JsonKey(
    
    name: r'sentAt',
    required: true,
    includeIfNull: true,
  )


  final DateTime? sentAt;



  @JsonKey(
    
    name: r'cancelledAt',
    required: true,
    includeIfNull: true,
  )


  final DateTime? cancelledAt;



      /// Issue de la branche E-MAIL, seul canal sortant. NOT_CONFIGURED quand aucune clé Brevo n’est fournie : les lignes de livraison existent et la boîte de réception les montre, aucun e-mail n’est parti. TRANSPORT_ERROR quand Brevo a tout refusé ; les livraisons restent en file et seront réessayées.
  @JsonKey(
    
    name: r'transportStatus',
    required: true,
    includeIfNull: true,
  )


  final String? transportStatus;



  @JsonKey(
    
    name: r'createdByName',
    required: true,
    includeIfNull: true,
  )


  final String? createdByName;



  @JsonKey(
    
    name: r'createdAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime createdAt;



  @JsonKey(
    
    name: r'counts',
    required: true,
    includeIfNull: false,
  )


  final NotificationDeliveryCountsDto counts;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is NotificationDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            title,
            body,
            category,
            route,
            audience,
            audienceRole,
            audienceUserIds,
            status,
            scheduledFor,
            sentAt,
            cancelledAt,
            transportStatus,
            createdByName,
            createdAt,
            counts,
        ],
        [
            other.id,
            other.title,
            other.body,
            other.category,
            other.route,
            other.audience,
            other.audienceRole,
            other.audienceUserIds,
            other.status,
            other.scheduledFor,
            other.sentAt,
            other.cancelledAt,
            other.transportStatus,
            other.createdByName,
            other.createdAt,
            other.counts,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        title,
        body,
        category,
        route,
        audience,
        audienceRole,
        audienceUserIds,
        status,
        scheduledFor,
        sentAt,
        cancelledAt,
        transportStatus,
        createdByName,
        createdAt,
        counts,
    ],);

  factory NotificationDto.fromJson(Map<String, dynamic> json) => _$NotificationDtoFromJson(json);

  Map<String, dynamic> toJson() => _$NotificationDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

