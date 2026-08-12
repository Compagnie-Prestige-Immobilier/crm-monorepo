//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'reassign_prospects_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReassignProspectsDto {
  /// Returns a new [ReassignProspectsDto] instance.
  ReassignProspectsDto({
    required this.prospectIds,

    this.representantId,

    this.commercialId,
  });

  /// Identifiants des prospects à réaffecter.
  @JsonKey(name: r'prospectIds', required: true, includeIfNull: false)
  final List<String> prospectIds;

  /// Nouveau représentant de rattachement.
  @JsonKey(name: r'representantId', required: false, includeIfNull: false)
  final String? representantId;

  /// Nouveau commercial propriétaire. Réservé à l’ADMIN.
  @JsonKey(name: r'commercialId', required: false, includeIfNull: false)
  final String? commercialId;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ReassignProspectsDto &&
            runtimeType == other.runtimeType &&
            equals(
              [prospectIds, representantId, commercialId],
              [other.prospectIds, other.representantId, other.commercialId],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([prospectIds, representantId, commercialId]);

  factory ReassignProspectsDto.fromJson(Map<String, dynamic> json) =>
      _$ReassignProspectsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ReassignProspectsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
