//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/time_bucket_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'analytics_series_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AnalyticsSeriesDto {
  /// Returns a new [AnalyticsSeriesDto] instance.
  AnalyticsSeriesDto({required this.buckets});

  @JsonKey(name: r'buckets', required: true, includeIfNull: false)
  final List<TimeBucketDto> buckets;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is AnalyticsSeriesDto &&
            runtimeType == other.runtimeType &&
            equals([buckets], [other.buckets]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([buckets]);

  factory AnalyticsSeriesDto.fromJson(Map<String, dynamic> json) =>
      _$AnalyticsSeriesDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AnalyticsSeriesDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
