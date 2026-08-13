//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantDto {
  /// Returns a new [RepresentantDto] instance.
  RepresentantDto({
    required this.id,

    required this.fullName,

    required this.phoneE164,

    required this.notes,

    required this.rev,

    required this.departementId,

    required this.departementName,

    required this.iefId,

    required this.iefName,

    required this.createdById,

    required this.createdByName,

    required this.clientCreatedAt,

    required this.createdAt,

    required this.updatedAt,

    required this.prospectCount,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'fullName', required: true, includeIfNull: false)
  final String fullName;

  /// Téléphone normalisé E.164.
  @JsonKey(name: r'phoneE164', required: true, includeIfNull: false)
  final String phoneE164;

  @JsonKey(name: r'notes', required: true, includeIfNull: true)
  final String? notes;

  /// Révision serveur, incrémentée à chaque écriture.
  @JsonKey(name: r'rev', required: true, includeIfNull: false)
  final num rev;

  @JsonKey(name: r'departementId', required: true, includeIfNull: false)
  final String departementId;

  @JsonKey(name: r'departementName', required: true, includeIfNull: false)
  final String departementName;

  @JsonKey(name: r'iefId', required: true, includeIfNull: true)
  final String? iefId;

  @JsonKey(name: r'iefName', required: true, includeIfNull: true)
  final String? iefName;

  @JsonKey(name: r'createdById', required: true, includeIfNull: false)
  final String createdById;

  @JsonKey(name: r'createdByName', required: true, includeIfNull: false)
  final String createdByName;

  @JsonKey(name: r'clientCreatedAt', required: true, includeIfNull: false)
  final DateTime clientCreatedAt;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  @JsonKey(name: r'prospectCount', required: true, includeIfNull: false)
  final num prospectCount;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepresentantDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                fullName,
                phoneE164,
                notes,
                rev,
                departementId,
                departementName,
                iefId,
                iefName,
                createdById,
                createdByName,
                clientCreatedAt,
                createdAt,
                updatedAt,
                prospectCount,
              ],
              [
                other.id,
                other.fullName,
                other.phoneE164,
                other.notes,
                other.rev,
                other.departementId,
                other.departementName,
                other.iefId,
                other.iefName,
                other.createdById,
                other.createdByName,
                other.clientCreatedAt,
                other.createdAt,
                other.updatedAt,
                other.prospectCount,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        fullName,
        phoneE164,
        notes,
        rev,
        departementId,
        departementName,
        iefId,
        iefName,
        createdById,
        createdByName,
        clientCreatedAt,
        createdAt,
        updatedAt,
        prospectCount,
      ]);

  factory RepresentantDto.fromJson(Map<String, dynamic> json) =>
      _$RepresentantDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
