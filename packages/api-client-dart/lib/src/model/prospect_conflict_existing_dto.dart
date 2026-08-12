//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'prospect_conflict_existing_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProspectConflictExistingDto {
  /// Returns a new [ProspectConflictExistingDto] instance.
  ProspectConflictExistingDto({
    required this.id,

    required this.nom,

    required this.prenom,

    required this.representantId,

    required this.representantName,

    required this.ownedByCommercialId,

    required this.ownedByCommercialName,

    required this.createdAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'nom', required: true, includeIfNull: false)
  final String nom;

  @JsonKey(name: r'prenom', required: true, includeIfNull: false)
  final String prenom;

  @JsonKey(name: r'representantId', required: true, includeIfNull: false)
  final String representantId;

  @JsonKey(name: r'representantName', required: true, includeIfNull: false)
  final String representantName;

  @JsonKey(name: r'ownedByCommercialId', required: true, includeIfNull: false)
  final String ownedByCommercialId;

  @JsonKey(name: r'ownedByCommercialName', required: true, includeIfNull: false)
  final String ownedByCommercialName;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ProspectConflictExistingDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                nom,
                prenom,
                representantId,
                representantName,
                ownedByCommercialId,
                ownedByCommercialName,
                createdAt,
              ],
              [
                other.id,
                other.nom,
                other.prenom,
                other.representantId,
                other.representantName,
                other.ownedByCommercialId,
                other.ownedByCommercialName,
                other.createdAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        nom,
        prenom,
        representantId,
        representantName,
        ownedByCommercialId,
        ownedByCommercialName,
        createdAt,
      ]);

  factory ProspectConflictExistingDto.fromJson(Map<String, dynamic> json) =>
      _$ProspectConflictExistingDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ProspectConflictExistingDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
