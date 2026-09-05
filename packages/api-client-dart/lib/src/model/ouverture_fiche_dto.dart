//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'ouverture_fiche_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OuvertureFicheDto {
  /// Returns a new [OuvertureFicheDto] instance.
  OuvertureFicheDto({
    required this.id,

    required this.openedById,

    required this.openedByName,

    required this.representantId,

    required this.prospectId,

    required this.ficheNom,

    required this.openedAt,

    required this.closedAt,

    required this.dureeSecondes,

    required this.closingAttemptId,

    required this.draft,

    required this.releasedByName,

    required this.releasedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'openedById', required: true, includeIfNull: false)
  final String openedById;

  @JsonKey(name: r'openedByName', required: true, includeIfNull: false)
  final String openedByName;

  @JsonKey(name: r'representantId', required: true, includeIfNull: true)
  final String? representantId;

  @JsonKey(name: r'prospectId', required: true, includeIfNull: true)
  final String? prospectId;

  /// Nom de la fiche ouverte.
  @JsonKey(name: r'ficheNom', required: true, includeIfNull: false)
  final String ficheNom;

  @JsonKey(name: r'openedAt', required: true, includeIfNull: false)
  final DateTime openedAt;

  /// Nul tant que la fiche est verrouillée.
  @JsonKey(name: r'closedAt', required: true, includeIfNull: true)
  final DateTime? closedAt;

  /// Durée de traitement, lue entre les deux bornes et jamais stockée. Distincte de la durée de communication du journal d’appels.
  @JsonKey(name: r'dureeSecondes', required: true, includeIfNull: true)
  final num? dureeSecondes;

  @JsonKey(name: r'closingAttemptId', required: true, includeIfNull: true)
  final String? closingAttemptId;

  /// Réponses saisies, restituées au rappel et après un plantage.
  @JsonKey(name: r'draft', required: true, includeIfNull: true)
  final Map<String, Object>? draft;

  @JsonKey(name: r'releasedByName', required: true, includeIfNull: true)
  final String? releasedByName;

  @JsonKey(name: r'releasedAt', required: true, includeIfNull: true)
  final DateTime? releasedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is OuvertureFicheDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                openedById,
                openedByName,
                representantId,
                prospectId,
                ficheNom,
                openedAt,
                closedAt,
                dureeSecondes,
                closingAttemptId,
                draft,
                releasedByName,
                releasedAt,
              ],
              [
                other.id,
                other.openedById,
                other.openedByName,
                other.representantId,
                other.prospectId,
                other.ficheNom,
                other.openedAt,
                other.closedAt,
                other.dureeSecondes,
                other.closingAttemptId,
                other.draft,
                other.releasedByName,
                other.releasedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        openedById,
        openedByName,
        representantId,
        prospectId,
        ficheNom,
        openedAt,
        closedAt,
        dureeSecondes,
        closingAttemptId,
        draft,
        releasedByName,
        releasedAt,
      ]);

  factory OuvertureFicheDto.fromJson(Map<String, dynamic> json) =>
      _$OuvertureFicheDtoFromJson(json);

  Map<String, dynamic> toJson() => _$OuvertureFicheDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
