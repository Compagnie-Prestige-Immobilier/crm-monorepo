//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/visite_referentiel_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_referentiels_bundle_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteReferentielsBundleDto {
  /// Returns a new [VisiteReferentielsBundleDto] instance.
  VisiteReferentielsBundleDto({
    required this.entreprises,

    required this.directions,

    required this.destinataires,

    required this.objets,
  });

  @JsonKey(name: r'entreprises', required: true, includeIfNull: false)
  final List<VisiteReferentielDto> entreprises;

  @JsonKey(name: r'directions', required: true, includeIfNull: false)
  final List<VisiteReferentielDto> directions;

  @JsonKey(name: r'destinataires', required: true, includeIfNull: false)
  final List<VisiteReferentielDto> destinataires;

  @JsonKey(name: r'objets', required: true, includeIfNull: false)
  final List<VisiteReferentielDto> objets;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is VisiteReferentielsBundleDto &&
            runtimeType == other.runtimeType &&
            equals(
              [entreprises, directions, destinataires, objets],
              [
                other.entreprises,
                other.directions,
                other.destinataires,
                other.objets,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([entreprises, directions, destinataires, objets]);

  factory VisiteReferentielsBundleDto.fromJson(Map<String, dynamic> json) =>
      _$VisiteReferentielsBundleDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteReferentielsBundleDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
