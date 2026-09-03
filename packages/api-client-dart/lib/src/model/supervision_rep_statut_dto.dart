//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'supervision_rep_statut_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SupervisionRepStatutDto {
  /// Returns a new [SupervisionRepStatutDto] instance.
  SupervisionRepStatutDto({
    required this.id,

    required this.code,

    required this.label,

    required this.isActive,

    required this.count,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  @JsonKey(name: r'count', required: true, includeIfNull: false)
  final num count;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SupervisionRepStatutDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, code, label, isActive, count],
              [other.id, other.code, other.label, other.isActive, other.count],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([id, code, label, isActive, count]);

  factory SupervisionRepStatutDto.fromJson(Map<String, dynamic> json) =>
      _$SupervisionRepStatutDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisionRepStatutDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
