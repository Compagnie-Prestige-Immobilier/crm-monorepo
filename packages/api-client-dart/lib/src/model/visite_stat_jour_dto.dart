//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_stat_jour_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteStatJourDto {
  /// Returns a new [VisiteStatJourDto] instance.
  VisiteStatJourDto({required this.date, required this.count});

  @JsonKey(name: r'date', required: true, includeIfNull: false)
  final String date;

  @JsonKey(name: r'count', required: true, includeIfNull: false)
  final num count;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is VisiteStatJourDto &&
            runtimeType == other.runtimeType &&
            equals([date, count], [other.date, other.count]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([date, count]);

  factory VisiteStatJourDto.fromJson(Map<String, dynamic> json) =>
      _$VisiteStatJourDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteStatJourDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
