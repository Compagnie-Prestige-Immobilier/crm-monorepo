//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/visite_stat_saisie_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_heure_jour_semaine_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_bucket_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_jour_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_agent_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_croisement_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_recurrent_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_jour_semaine_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_mois_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_heure_dto.dart';
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

    required this.parHeure,

    required this.sansHeure,

    required this.parJourSemaine,

    required this.parHeureJourSemaine,

    required this.parAgent,

    required this.parEntrepriseObjet,

    required this.parDestinataireDirection,

    required this.parObjetMois,

    required this.recurrents,

    required this.partRecurrents,

    required this.avecTelephone,

    required this.saisieDifferee,
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

  /// Les 24 heures de la journée, à Dakar. Les visites sans heure relevée en sont exclues.
  @JsonKey(name: r'parHeure', required: true, includeIfNull: false)
  final List<VisiteStatHeureDto> parHeure;

  /// Visites sans heure relevée.
  @JsonKey(name: r'sansHeure', required: true, includeIfNull: false)
  final num sansHeure;

  /// Les 7 jours de la semaine ISO (lundi = 1), toutes visites comprises.
  @JsonKey(name: r'parJourSemaine', required: true, includeIfNull: false)
  final List<VisiteStatJourSemaineDto> parJourSemaine;

  /// Croisement heure × jour de semaine, cellules non nulles seulement, 168 au plus.
  @JsonKey(name: r'parHeureJourSemaine', required: true, includeIfNull: false)
  final List<VisiteStatHeureJourSemaineDto> parHeureJourSemaine;

  /// L’agent d’accueil qui a saisi chaque visite.
  @JsonKey(name: r'parAgent', required: true, includeIfNull: false)
  final List<VisiteStatAgentDto> parAgent;

  @JsonKey(name: r'parEntrepriseObjet', required: true, includeIfNull: false)
  final List<VisiteStatCroisementDto> parEntrepriseObjet;

  @JsonKey(
    name: r'parDestinataireDirection',
    required: true,
    includeIfNull: false,
  )
  final List<VisiteStatCroisementDto> parDestinataireDirection;

  @JsonKey(name: r'parObjetMois', required: true, includeIfNull: false)
  final List<VisiteStatCroisementDto> parObjetMois;

  /// Visiteurs vus au moins deux fois sur la période, dix au plus. Regroupés par téléphone, sinon par nom : jamais le numéro.
  @JsonKey(name: r'recurrents', required: true, includeIfNull: false)
  final List<VisiteStatRecurrentDto> recurrents;

  /// Part des visites faites par des visiteurs récurrents.
  @JsonKey(name: r'partRecurrents', required: true, includeIfNull: false)
  final num partRecurrents;

  /// Visites portant un numéro de téléphone.
  @JsonKey(name: r'avecTelephone', required: true, includeIfNull: false)
  final num avecTelephone;

  /// Délai entre la visite et sa saisie.
  @JsonKey(name: r'saisieDifferee', required: true, includeIfNull: false)
  final VisiteStatSaisieDto saisieDifferee;

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
                parHeure,
                sansHeure,
                parJourSemaine,
                parHeureJourSemaine,
                parAgent,
                parEntrepriseObjet,
                parDestinataireDirection,
                parObjetMois,
                recurrents,
                partRecurrents,
                avecTelephone,
                saisieDifferee,
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
                other.parHeure,
                other.sansHeure,
                other.parJourSemaine,
                other.parHeureJourSemaine,
                other.parAgent,
                other.parEntrepriseObjet,
                other.parDestinataireDirection,
                other.parObjetMois,
                other.recurrents,
                other.partRecurrents,
                other.avecTelephone,
                other.saisieDifferee,
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
        parHeure,
        sansHeure,
        parJourSemaine,
        parHeureJourSemaine,
        parAgent,
        parEntrepriseObjet,
        parDestinataireDirection,
        parObjetMois,
        recurrents,
        partRecurrents,
        avecTelephone,
        saisieDifferee,
      ]);

  factory VisiteStatsDto.fromJson(Map<String, dynamic> json) =>
      _$VisiteStatsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteStatsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
