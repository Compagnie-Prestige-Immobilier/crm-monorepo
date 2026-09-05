//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'reassign_result_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReassignResultDto {
  /// Returns a new [ReassignResultDto] instance.
  ReassignResultDto({required this.updated, required this.prospectIds});

  @JsonKey(name: r'updated', required: true, includeIfNull: false)
  final num updated;

  /// Identifiants effectivement réaffectés.
  @JsonKey(name: r'prospectIds', required: true, includeIfNull: false)
  final List<String> prospectIds;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ReassignResultDto &&
            runtimeType == other.runtimeType &&
            equals([updated, prospectIds], [other.updated, other.prospectIds]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([updated, prospectIds]);

  factory ReassignResultDto.fromJson(Map<String, dynamic> json) =>
      _$ReassignResultDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ReassignResultDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
