//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_stat_croisement_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteStatCroisementDto {
  /// Returns a new [VisiteStatCroisementDto] instance.
  VisiteStatCroisementDto({
    required this.ligneId,

    required this.colonneId,

    required this.count,
  });

  /// Identifiant de la dimension en ligne.
  @JsonKey(name: r'ligneId', required: true, includeIfNull: false)
  final String ligneId;

  /// Identifiant de la dimension en colonne.
  @JsonKey(name: r'colonneId', required: true, includeIfNull: false)
  final String colonneId;

  @JsonKey(name: r'count', required: true, includeIfNull: false)
  final num count;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is VisiteStatCroisementDto &&
            runtimeType == other.runtimeType &&
            equals(
              [ligneId, colonneId, count],
              [other.ligneId, other.colonneId, other.count],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([ligneId, colonneId, count]);

  factory VisiteStatCroisementDto.fromJson(Map<String, dynamic> json) =>
      _$VisiteStatCroisementDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteStatCroisementDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
