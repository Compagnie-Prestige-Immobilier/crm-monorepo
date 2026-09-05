//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_stat_heure_jour_semaine_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteStatHeureJourSemaineDto {
  /// Returns a new [VisiteStatHeureJourSemaineDto] instance.
  VisiteStatHeureJourSemaineDto({
    required this.weekday,

    required this.hour,

    required this.count,
  });

  // minimum: 1
  // maximum: 7
  @JsonKey(name: r'weekday', required: true, includeIfNull: false)
  final num weekday;

  // minimum: 0
  // maximum: 23
  @JsonKey(name: r'hour', required: true, includeIfNull: false)
  final num hour;

  @JsonKey(name: r'count', required: true, includeIfNull: false)
  final num count;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is VisiteStatHeureJourSemaineDto &&
            runtimeType == other.runtimeType &&
            equals(
              [weekday, hour, count],
              [other.weekday, other.hour, other.count],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([weekday, hour, count]);

  factory VisiteStatHeureJourSemaineDto.fromJson(Map<String, dynamic> json) =>
      _$VisiteStatHeureJourSemaineDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteStatHeureJourSemaineDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
