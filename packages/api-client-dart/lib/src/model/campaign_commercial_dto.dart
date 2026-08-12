//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/campaign_progress_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'campaign_commercial_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CampaignCommercialDto {
  /// Returns a new [CampaignCommercialDto] instance.
  CampaignCommercialDto({
    required this.userId,

    required this.fullName,

    required this.username,

    required this.position,

    required this.progress,
  });

  @JsonKey(name: r'userId', required: true, includeIfNull: false)
  final String userId;

  @JsonKey(name: r'fullName', required: true, includeIfNull: false)
  final String fullName;

  @JsonKey(name: r'username', required: true, includeIfNull: false)
  final String username;

  /// Rang dans le tourniquet, à partir de 1.
  @JsonKey(name: r'position', required: true, includeIfNull: false)
  final num position;

  @JsonKey(name: r'progress', required: true, includeIfNull: false)
  final CampaignProgressDto progress;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CampaignCommercialDto &&
            runtimeType == other.runtimeType &&
            equals(
              [userId, fullName, username, position, progress],
              [
                other.userId,
                other.fullName,
                other.username,
                other.position,
                other.progress,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([userId, fullName, username, position, progress]);

  factory CampaignCommercialDto.fromJson(Map<String, dynamic> json) =>
      _$CampaignCommercialDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CampaignCommercialDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
