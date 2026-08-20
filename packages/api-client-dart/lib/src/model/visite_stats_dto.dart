//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/visite_stat_bucket_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_jour_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_mois_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_stats_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteStatsDto {
  /// Returns a new [VisiteStatsDto] instance.
  VisiteStatsDto({
    required this.from,

    required this.to,

    required this.total,

    required this.parEntreprise,

    required this.parDirection,

    required this.parDestinataire,

    required this.parObjet,

    required this.parMois,

    required this.parJour,

    required this.sansDirection,

    required this.sansDestinataire,
  });

  @JsonKey(name: r'from', required: true, includeIfNull: false)
  final String from;

  @JsonKey(name: r'to', required: true, includeIfNull: false)
  final String to;

  /// Nombre de visites. La somme d’une répartition peut lui être inférieure : direction et destinataire sont facultatifs.
  @JsonKey(name: r'total', required: true, includeIfNull: false)
  final num total;

  /// Toutes les entrées actives du référentiel, y compris celles à zéro.
  @JsonKey(name: r'parEntreprise', required: true, includeIfNull: false)
  final List<VisiteStatBucketDto> parEntreprise;

  @JsonKey(name: r'parDirection', required: true, includeIfNull: false)
  final List<VisiteStatBucketDto> parDirection;

  @JsonKey(name: r'parDestinataire', required: true, includeIfNull: false)
  final List<VisiteStatBucketDto> parDestinataire;

  @JsonKey(name: r'parObjet', required: true, includeIfNull: false)
  final List<VisiteStatBucketDto> parObjet;

  /// Chaque mois de la période.
  @JsonKey(name: r'parMois', required: true, includeIfNull: false)
  final List<VisiteStatMoisDto> parMois;

  /// Seuls les jours ayant reçu au moins une visite.
  @JsonKey(name: r'parJour', required: true, includeIfNull: false)
  final List<VisiteStatJourDto> parJour;

  @JsonKey(name: r'sansDirection', required: true, includeIfNull: false)
  final num sansDirection;

  @JsonKey(name: r'sansDestinataire', required: true, includeIfNull: false)
  final num sansDestinataire;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is VisiteStatsDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                from,
                to,
                total,
                parEntreprise,
                parDirection,
                parDestinataire,
                parObjet,
                parMois,
                parJour,
                sansDirection,
                sansDestinataire,
              ],
              [
                other.from,
                other.to,
                other.total,
                other.parEntreprise,
                other.parDirection,
                other.parDestinataire,
                other.parObjet,
                other.parMois,
                other.parJour,
                other.sansDirection,
                other.sansDestinataire,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        from,
        to,
        total,
        parEntreprise,
        parDirection,
        parDestinataire,
        parObjet,
        parMois,
        parJour,
        sansDirection,
        sansDestinataire,
      ]);

  factory VisiteStatsDto.fromJson(Map<String, dynamic> json) =>
      _$VisiteStatsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteStatsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
