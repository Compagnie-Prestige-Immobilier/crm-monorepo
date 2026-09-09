//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/phase2_status.dart';
import 'package:crm_api_client/src/model/enrollment_method.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'directory_entry_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DirectoryEntryDto {
  /// Returns a new [DirectoryEntryDto] instance.
  DirectoryEntryDto({
    required this.prospectId,

    required this.phoneE164,

    required this.phase2Status,

    required this.enrollmentMethod,

    required this.rev,

    required this.updatedAt,
  });

  @JsonKey(name: r'prospectId', required: true, includeIfNull: false)
  final String prospectId;

  /// Numéro normalisé E.164.
  @JsonKey(name: r'phoneE164', required: true, includeIfNull: false)
  final String phoneE164;

  @JsonKey(
    name: r'phase2Status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: Phase2Status.unknownDefaultOpenApi,
  )
  final Phase2Status phase2Status;

  /// Non nulle si et seulement si phase2Status vaut METHOD_OBTAINED.
  @JsonKey(
    name: r'enrollmentMethod',
    required: true,
    includeIfNull: true,
    unknownEnumValue: EnrollmentMethod.unknownDefaultOpenApi,
  )
  final EnrollmentMethod? enrollmentMethod;

  /// Révision serveur, pour la résolution de conflits.
  @JsonKey(name: r'rev', required: true, includeIfNull: false)
  final num rev;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DirectoryEntryDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                prospectId,
                phoneE164,
                phase2Status,
                enrollmentMethod,
                rev,
                updatedAt,
              ],
              [
                other.prospectId,
                other.phoneE164,
                other.phase2Status,
                other.enrollmentMethod,
                other.rev,
                other.updatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        prospectId,
        phoneE164,
        phase2Status,
        enrollmentMethod,
        rev,
        updatedAt,
      ]);

  factory DirectoryEntryDto.fromJson(Map<String, dynamic> json) =>
      _$DirectoryEntryDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DirectoryEntryDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
