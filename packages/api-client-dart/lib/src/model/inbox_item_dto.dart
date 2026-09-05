//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/notification_category.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'inbox_item_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class InboxItemDto {
  /// Returns a new [InboxItemDto] instance.
  InboxItemDto({

    required  this.id,

    required  this.notificationId,

    required  this.title,

    required  this.body,

    required  this.category,

    required  this.route,

    required  this.isRead,

    required  this.readAt,

    required  this.createdAt,
  });

      /// Identifiant de la LIVRAISON, pas de l’envoi.
  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'notificationId',
    required: true,
    includeIfNull: false,
  )


  final String notificationId;



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



  @JsonKey(
    
    name: r'route',
    required: true,
    includeIfNull: true,
  )


  final String? route;



  @JsonKey(
    
    name: r'isRead',
    required: true,
    includeIfNull: false,
  )


  final bool isRead;



  @JsonKey(
    
    name: r'readAt',
    required: true,
    includeIfNull: true,
  )


  final DateTime? readAt;



  @JsonKey(
    
    name: r'createdAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime createdAt;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is InboxItemDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            notificationId,
            title,
            body,
            category,
            route,
            isRead,
            readAt,
            createdAt,
        ],
        [
            other.id,
            other.notificationId,
            other.title,
            other.body,
            other.category,
            other.route,
            other.isRead,
            other.readAt,
            other.createdAt,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        notificationId,
        title,
        body,
        category,
        route,
        isRead,
        readAt,
        createdAt,
    ],);

  factory InboxItemDto.fromJson(Map<String, dynamic> json) => _$InboxItemDtoFromJson(json);

  Map<String, dynamic> toJson() => _$InboxItemDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

