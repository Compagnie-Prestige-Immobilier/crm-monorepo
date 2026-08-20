//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_stat_mois_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteStatMoisDto {
  /// Returns a new [VisiteStatMoisDto] instance.
  VisiteStatMoisDto({required this.month, required this.count});

  @JsonKey(name: r'month', required: true, includeIfNull: false)
  final String month;

  @JsonKey(name: r'count', required: true, includeIfNull: false)
  final num count;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is VisiteStatMoisDto &&
            runtimeType == other.runtimeType &&
            equals([month, count], [other.month, other.count]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([month, count]);

  factory VisiteStatMoisDto.fromJson(Map<String, dynamic> json) =>
      _$VisiteStatMoisDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteStatMoisDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
