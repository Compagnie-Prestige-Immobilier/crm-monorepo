//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/notification_delivery_status.dart';
import 'package:crm_api_client/src/model/role.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'notification_recipient_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NotificationRecipientDto {
  /// Returns a new [NotificationRecipientDto] instance.
  NotificationRecipientDto({

    required  this.userId,

    required  this.fullName,

    required  this.role,

    required  this.status,

    required  this.error,

    required  this.sentAt,

    required  this.readAt,
  });

  @JsonKey(
    
    name: r'userId',
    required: true,
    includeIfNull: false,
  )


  final String userId;



  @JsonKey(
    
    name: r'fullName',
    required: true,
    includeIfNull: false,
  )


  final String fullName;



  @JsonKey(
    
    name: r'role',
    required: true,
    includeIfNull: false,
  unknownEnumValue: Role.unknownDefaultOpenApi,
  )


  final Role role;



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  unknownEnumValue: NotificationDeliveryStatus.unknownDefaultOpenApi,
  )


  final NotificationDeliveryStatus status;



  @JsonKey(
    
    name: r'error',
    required: true,
    includeIfNull: true,
  )


  final String? error;



  @JsonKey(
    
    name: r'sentAt',
    required: true,
    includeIfNull: true,
  )


  final DateTime? sentAt;



  @JsonKey(
    
    name: r'readAt',
    required: true,
    includeIfNull: true,
  )


  final DateTime? readAt;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is NotificationRecipientDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            userId,
            fullName,
            role,
            status,
            error,
            sentAt,
            readAt,
        ],
        [
            other.userId,
            other.fullName,
            other.role,
            other.status,
            other.error,
            other.sentAt,
            other.readAt,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        userId,
        fullName,
        role,
        status,
        error,
        sentAt,
        readAt,
    ],);

  factory NotificationRecipientDto.fromJson(Map<String, dynamic> json) => _$NotificationRecipientDtoFromJson(json);

  Map<String, dynamic> toJson() => _$NotificationRecipientDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

