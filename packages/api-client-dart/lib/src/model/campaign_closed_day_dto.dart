//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'campaign_closed_day_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CampaignClosedDayDto {
  /// Returns a new [CampaignClosedDayDto] instance.
  CampaignClosedDayDto({
    required this.day,

    required this.commercialId,

    required this.commercialName,

    required this.done,
  });

  /// Journée, au format AAAA-MM-JJ.
  @JsonKey(name: r'day', required: true, includeIfNull: false)
  final DateTime day;

  @JsonKey(name: r'commercialId', required: true, includeIfNull: false)
  final String commercialId;

  @JsonKey(name: r'commercialName', required: true, includeIfNull: false)
  final String commercialName;

  /// Tâches clôturées ce jour-là par ce commercial.
  @JsonKey(name: r'done', required: true, includeIfNull: false)
  final num done;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CampaignClosedDayDto &&
            runtimeType == other.runtimeType &&
            equals(
              [day, commercialId, commercialName, done],
              [other.day, other.commercialId, other.commercialName, other.done],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([day, commercialId, commercialName, done]);

  factory CampaignClosedDayDto.fromJson(Map<String, dynamic> json) =>
      _$CampaignClosedDayDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CampaignClosedDayDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
