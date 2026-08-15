//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/delay_leg_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'analytics_delays_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AnalyticsDelaysDto {
  /// Returns a new [AnalyticsDelaysDto] instance.
  AnalyticsDelaysDto({required this.legs});

  /// Les trois tronçons, du prospect saisi au dossier encaissé.
  @JsonKey(name: r'legs', required: true, includeIfNull: false)
  final List<DelayLegDto> legs;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is AnalyticsDelaysDto &&
            runtimeType == other.runtimeType &&
            equals([legs], [other.legs]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([legs]);

  factory AnalyticsDelaysDto.fromJson(Map<String, dynamic> json) =>
      _$AnalyticsDelaysDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AnalyticsDelaysDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
