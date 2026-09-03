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
  UpdateStatutQualificationDto({this.label, this.requiresCallback});

  @JsonKey(name: r'label', required: false, includeIfNull: false)
  final String? label;

  @JsonKey(name: r'requiresCallback', required: false, includeIfNull: false)
  final bool? requiresCallback;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateStatutQualificationDto &&
            runtimeType == other.runtimeType &&
            equals(
              [label, requiresCallback],
              [other.label, other.requiresCallback],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([label, requiresCallback]);

  factory UpdateStatutQualificationDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateStatutQualificationDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateStatutQualificationDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
