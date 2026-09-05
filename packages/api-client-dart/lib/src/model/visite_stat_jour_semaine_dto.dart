//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_stat_jour_semaine_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteStatJourSemaineDto {
  /// Returns a new [VisiteStatJourSemaineDto] instance.
  VisiteStatJourSemaineDto({required this.weekday, required this.count});

  /// ISO : lundi = 1.
  // minimum: 1
  // maximum: 7
  @JsonKey(name: r'weekday', required: true, includeIfNull: false)
  final num weekday;

  @JsonKey(name: r'count', required: true, includeIfNull: false)
  final num count;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is VisiteStatJourSemaineDto &&
            runtimeType == other.runtimeType &&
            equals([weekday, count], [other.weekday, other.count]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([weekday, count]);

  factory VisiteStatJourSemaineDto.fromJson(Map<String, dynamic> json) =>
      _$VisiteStatJourSemaineDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteStatJourSemaineDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
