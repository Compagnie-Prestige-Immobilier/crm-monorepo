//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'supervision_teleconseiller_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SupervisionTeleconseillerDto {
  /// Returns a new [SupervisionTeleconseillerDto] instance.
  SupervisionTeleconseillerDto({
    required this.id,

    required this.fullName,

    required this.isActive,

    required this.openTasks,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'fullName', required: true, includeIfNull: false)
  final String fullName;

  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  /// Tâches d’appel encore OUVERTES. Instantané : la fenêtre ne le borne pas.
  @JsonKey(name: r'openTasks', required: true, includeIfNull: false)
  final num openTasks;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SupervisionTeleconseillerDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, fullName, isActive, openTasks],
              [other.id, other.fullName, other.isActive, other.openTasks],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([id, fullName, isActive, openTasks]);

  factory SupervisionTeleconseillerDto.fromJson(Map<String, dynamic> json) =>
      _$SupervisionTeleconseillerDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisionTeleconseillerDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
