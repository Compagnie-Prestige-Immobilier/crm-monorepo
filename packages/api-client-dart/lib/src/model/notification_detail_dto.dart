//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/notification_dto.dart';
import 'package:crm_api_client/src/model/notification_recipient_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'notification_detail_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NotificationDetailDto {
  /// Returns a new [NotificationDetailDto] instance.
  NotificationDetailDto({required this.notification, required this.recipients});

  @JsonKey(name: r'notification', required: true, includeIfNull: false)
  final NotificationDto notification;

  /// Une ligne par destinataire, c’est ce qui rend « qui a reçu ? » répondable.
  @JsonKey(name: r'recipients', required: true, includeIfNull: false)
  final List<NotificationRecipientDto> recipients;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is NotificationDetailDto &&
            runtimeType == other.runtimeType &&
            equals(
              [notification, recipients],
              [other.notification, other.recipients],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([notification, recipients]);

  factory NotificationDetailDto.fromJson(Map<String, dynamic> json) =>
      _$NotificationDetailDtoFromJson(json);

  Map<String, dynamic> toJson() => _$NotificationDetailDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
