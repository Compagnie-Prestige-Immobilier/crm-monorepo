//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/campaign_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_rep_call_campaign_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncRepCallCampaignDto {
  /// Returns a new [SyncRepCallCampaignDto] instance.
  SyncRepCallCampaignDto({
    required this.id,

    required this.name,

    required this.status,

    required this.spreadDays,

    required this.updatedAt,

    this.closedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: CampaignStatus.unknownDefaultOpenApi,
  )
  final CampaignStatus status;

  /// Journees d’etalement de la file.
  @JsonKey(name: r'spreadDays', required: true, includeIfNull: false)
  final num spreadDays;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  @JsonKey(name: r'closedAt', required: false, includeIfNull: false)
  final DateTime? closedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SyncRepCallCampaignDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, name, status, spreadDays, updatedAt, closedAt],
              [
                other.id,
                other.name,
                other.status,
                other.spreadDays,
                other.updatedAt,
                other.closedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([id, name, status, spreadDays, updatedAt, closedAt]);

  factory SyncRepCallCampaignDto.fromJson(Map<String, dynamic> json) =>
      _$SyncRepCallCampaignDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncRepCallCampaignDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
