//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'change_prospect_segment_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ChangeProspectSegmentDto {
  /// Returns a new [ChangeProspectSegmentDto] instance.
  ChangeProspectSegmentDto({
    this.banqueId,

    this.syndicatId,

    required this.reason,

    required this.expectedRev,
  });

  /// Nouvelle banque. Omise, la banque courante est conservée.
  @JsonKey(name: r'banqueId', required: false, includeIfNull: false)
  final String? banqueId;

  /// Nouveau syndicat. Omis, le syndicat courant est conservé.
  @JsonKey(name: r'syndicatId', required: false, includeIfNull: false)
  final String? syndicatId;

  /// Motif en clair. Une bascule de segment n’est pas une correction de saisie.
  @JsonKey(name: r'reason', required: true, includeIfNull: false)
  final String reason;

  /// Révision attendue. Un écart renvoie PROSPECT_REV_CONFLICT avec la révision réelle.
  // minimum: 1
  @JsonKey(name: r'expectedRev', required: true, includeIfNull: false)
  final num expectedRev;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ChangeProspectSegmentDto &&
            runtimeType == other.runtimeType &&
            equals(
              [banqueId, syndicatId, reason, expectedRev],
              [
                other.banqueId,
                other.syndicatId,
                other.reason,
                other.expectedRev,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([banqueId, syndicatId, reason, expectedRev]);

  factory ChangeProspectSegmentDto.fromJson(Map<String, dynamic> json) =>
      _$ChangeProspectSegmentDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ChangeProspectSegmentDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
