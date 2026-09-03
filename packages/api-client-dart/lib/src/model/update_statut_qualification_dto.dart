//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_statut_qualification_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateStatutQualificationDto {
  /// Returns a new [UpdateStatutQualificationDto] instance.
  UpdateStatutQualificationDto({
    this.label,

    this.requiresCallback,

    this.sortOrder,
  });

  @JsonKey(name: r'label', required: false, includeIfNull: false)
  final String? label;

  @JsonKey(name: r'requiresCallback', required: false, includeIfNull: false)
  final bool? requiresCallback;

  // minimum: 0
  // maximum: 9999
  @JsonKey(name: r'sortOrder', required: false, includeIfNull: false)
  final num? sortOrder;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateStatutQualificationDto &&
            runtimeType == other.runtimeType &&
            equals(
              [label, requiresCallback, sortOrder],
              [other.label, other.requiresCallback, other.sortOrder],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([label, requiresCallback, sortOrder]);

  factory UpdateStatutQualificationDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateStatutQualificationDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateStatutQualificationDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
