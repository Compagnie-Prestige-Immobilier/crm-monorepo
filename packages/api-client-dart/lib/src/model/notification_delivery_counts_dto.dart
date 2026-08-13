//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'notification_delivery_counts_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NotificationDeliveryCountsDto {
  /// Returns a new [NotificationDeliveryCountsDto] instance.
  NotificationDeliveryCountsDto({
    required this.total,

    required this.pending,

    required this.sent,

    required this.delivered,

    required this.failed,

    required this.read,
  });

  @JsonKey(name: r'total', required: true, includeIfNull: false)
  final num total;

  /// En file : aucun push tenté (ou aucun appareil).
  @JsonKey(name: r'pending', required: true, includeIfNull: false)
  final num pending;

  /// Accepté par FCM. N’implique pas « affiché ».
  @JsonKey(name: r'sent', required: true, includeIfNull: false)
  final num sent;

  @JsonKey(name: r'delivered', required: true, includeIfNull: false)
  final num delivered;

  @JsonKey(name: r'failed', required: true, includeIfNull: false)
  final num failed;

  @JsonKey(name: r'read', required: true, includeIfNull: false)
  final num read;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is NotificationDeliveryCountsDto &&
            runtimeType == other.runtimeType &&
            equals(
              [total, pending, sent, delivered, failed, read],
              [
                other.total,
                other.pending,
                other.sent,
                other.delivered,
                other.failed,
                other.read,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([total, pending, sent, delivered, failed, read]);

  factory NotificationDeliveryCountsDto.fromJson(Map<String, dynamic> json) =>
      _$NotificationDeliveryCountsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$NotificationDeliveryCountsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
