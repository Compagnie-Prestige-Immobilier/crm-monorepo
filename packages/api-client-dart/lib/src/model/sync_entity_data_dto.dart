//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/prospect_type.dart';
import 'package:crm_api_client/src/model/call_outcome.dart';
import 'package:crm_api_client/src/model/prospect_statut.dart';
import 'package:crm_api_client/src/model/representant_relation.dart';
import 'package:crm_api_client/src/model/enrollment_method.dart';
import 'package:crm_api_client/src/model/whatsapp_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_entity_data_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncEntityDataDto {
  /// Returns a new [SyncEntityDataDto] instance.
  SyncEntityDataDto({
    this.fullName,

    this.nom,

    this.prenom,

    this.phone,

    this.departementId,

    this.iefId,

    this.banqueId,

    this.syndicatId,

    this.representantId,

    this.body,

    this.statut,

    this.notes,

    this.whatsappStatus,

    this.whatsappE164,

    this.profession,

    this.relationStatus,

    this.relationReason,

    this.etablissement,

    this.projet,

    this.type,

    this.dureeSystemeMois,

    this.canalProvenanceId,

    this.clientCreatedAt,

    this.prospectId,

    this.outcome,

    this.reasonCode,

    this.method,

    this.comment,

    this.callbackAt,

    this.email,

    this.fonctionnaire,

    this.engagementEnCours,

    this.dureeEtablissementMois,

    this.rendezVousAt,

    this.visitorName,

    this.visitDate,

    this.visitTime,

    this.entrepriseId,

    this.objetId,

    this.directionId,

    this.destinataireId,
  });

  /// Représentant : nom complet.
  @JsonKey(name: r'fullName', required: false, includeIfNull: false)
  final String? fullName;

  /// Prospect : nom.
  @JsonKey(name: r'nom', required: false, includeIfNull: false)
  final String? nom;

  /// Prospect : prénom.
  @JsonKey(name: r'prenom', required: false, includeIfNull: false)
  final String? prenom;

  /// Téléphone en saisie libre ; normalisé en E.164 par le serveur.
  @JsonKey(name: r'phone', required: false, includeIfNull: false)
  final String? phone;

  /// Représentant : département.
  @JsonKey(name: r'departementId', required: false, includeIfNull: false)
  final String? departementId;

  /// Représentant : IEF de rattachement, facultative. Une version ancienne de l’application ne l’envoie pas ; l’absence du champ laisse la valeur en place et ne l’efface pas.
  @JsonKey(name: r'iefId', required: false, includeIfNull: false)
  final String? iefId;

  /// Prospect : banque.
  @JsonKey(name: r'banqueId', required: false, includeIfNull: false)
  final String? banqueId;

  /// Prospect : syndicat.
  @JsonKey(name: r'syndicatId', required: false, includeIfNull: false)
  final String? syndicatId;

  /// Prospect : représentant de rattachement. Sert aussi de clé de groupe.
  @JsonKey(name: r'representantId', required: false, includeIfNull: false)
  final String? representantId;

  /// Commentaire ajouté à une fiche.
  @JsonKey(name: r'body', required: false, includeIfNull: false)
  final String? body;

  @JsonKey(
    name: r'statut',
    required: false,
    includeIfNull: false,
    unknownEnumValue: ProspectStatut.unknownDefaultOpenApi,
  )
  final ProspectStatut? statut;

  /// Représentant : notes libres.
  @JsonKey(name: r'notes', required: false, includeIfNull: false)
  final String? notes;

  /// Représentant : la question du WhatsApp a-t-elle été posée, et avec quelle réponse.
  @JsonKey(
    name: r'whatsappStatus',
    required: false,
    includeIfNull: false,
    unknownEnumValue: WhatsappStatus.unknownDefaultOpenApi,
  )
  final WhatsappStatus? whatsappStatus;

  /// Représentant : numéro WhatsApp, seulement si le statut vaut AUTRE_NUMERO.
  @JsonKey(name: r'whatsappE164', required: false, includeIfNull: false)
  final String? whatsappE164;

  /// Profession déclarée. Sert au représentant comme au prospect.
  @JsonKey(name: r'profession', required: false, includeIfNull: false)
  final String? profession;

  /// Représentant : où en est la relation. Un statut identique à celui déjà en base n’écrit rien.
  @JsonKey(
    name: r'relationStatus',
    required: false,
    includeIfNull: false,
    unknownEnumValue: RepresentantRelation.unknownDefaultOpenApi,
  )
  final RepresentantRelation? relationStatus;

  /// Motif de la bascule, repris dans la chronologie. FACULTATIF POUR TOUJOURS.
  @JsonKey(name: r'relationReason', required: false, includeIfNull: false)
  final String? relationReason;

  /// Représentant : l’établissement où il exerce. Ni l’IEF ni le département.
  @JsonKey(name: r'etablissement', required: false, includeIfNull: false)
  final String? etablissement;

  /// Prospect : le projet dont il relève. CHUES par défaut côté serveur.
  @JsonKey(
    name: r'projet',
    required: false,
    includeIfNull: false,
    unknownEnumValue: Projet.unknownDefaultOpenApi,
  )
  final Projet? projet;

  /// Prospect hors CHUES : ce qu’il est. Jamais obligatoire.
  @JsonKey(
    name: r'type',
    required: false,
    includeIfNull: false,
    unknownEnumValue: ProspectType.unknownDefaultOpenApi,
  )
  final ProspectType? type;

  /// Prospect : durée du système de paiement, en MOIS.
  // minimum: 1
  // maximum: 600
  @JsonKey(name: r'dureeSystemeMois', required: false, includeIfNull: false)
  final num? dureeSystemeMois;

  /// Prospect : canal de provenance, choisi dans le référentiel.
  @JsonKey(name: r'canalProvenanceId', required: false, includeIfNull: false)
  final String? canalProvenanceId;

  /// Horodatage de la saisie terrain.
  @JsonKey(name: r'clientCreatedAt', required: false, includeIfNull: false)
  final DateTime? clientCreatedAt;

  /// Tentative d’appel : prospect concerné. Sert aussi de clé de groupe.
  @JsonKey(name: r'prospectId', required: false, includeIfNull: false)
  final String? prospectId;

  @JsonKey(
    name: r'outcome',
    required: false,
    includeIfNull: false,
    unknownEnumValue: CallOutcome.unknownDefaultOpenApi,
  )
  final CallOutcome? outcome;

  /// Tentative d’appel : code du motif d’issue. FACULTATIF POUR TOUJOURS. Un lot qui ne le porte pas résout le motif système dont le code égale outcome.
  @JsonKey(name: r'reasonCode', required: false, includeIfNull: false)
  final String? reasonCode;

  /// Obligatoire si et seulement si outcome vaut METHOD_OBTAINED.
  @JsonKey(
    name: r'method',
    required: false,
    includeIfNull: false,
    unknownEnumValue: EnrollmentMethod.unknownDefaultOpenApi,
  )
  final EnrollmentMethod? method;

  /// Tentative d’appel : obligatoire et non vide si outcome vaut OTHER.
  @JsonKey(name: r'comment', required: false, includeIfNull: false)
  final String? comment;

  /// Tentative d’appel : date du rappel promis. Obligatoire si et seulement si outcome vaut CALLBACK. Une version ancienne de l’application ne l’envoie pas.
  @JsonKey(name: r'callbackAt', required: false, includeIfNull: false)
  final DateTime? callbackAt;

  /// Tentative d’appel : adresse électronique recueillie pendant l’appel.
  @JsonKey(name: r'email', required: false, includeIfNull: false)
  final String? email;

  /// Tentative d’appel : le prospect est-il fonctionnaire.
  @JsonKey(name: r'fonctionnaire', required: false, includeIfNull: false)
  final bool? fonctionnaire;

  /// Tentative d’appel : un engagement bancaire est-il en cours.
  @JsonKey(name: r'engagementEnCours', required: false, includeIfNull: false)
  final bool? engagementEnCours;

  /// Tentative d’appel : ancienneté dans l’établissement, en MOIS. Distincte de `dureeSystemeMois`, qui est la durée du système de paiement du prospect.
  // minimum: 0
  // maximum: 600
  @JsonKey(
    name: r'dureeEtablissementMois',
    required: false,
    includeIfNull: false,
  )
  final num? dureeEtablissementMois;

  /// Tentative d’appel : date du rendez-vous pris. Obligatoire si et seulement si method vaut APPOINTMENT.
  @JsonKey(name: r'rendezVousAt', required: false, includeIfNull: false)
  final DateTime? rendezVousAt;

  /// Visite : nom et prénom du visiteur.
  @JsonKey(name: r'visitorName', required: false, includeIfNull: false)
  final String? visitorName;

  /// Visite : jour, à Dakar.
  @JsonKey(name: r'visitDate', required: false, includeIfNull: false)
  final String? visitDate;

  /// Visite : heure, omise si elle n’a pas été relevée.
  @JsonKey(name: r'visitTime', required: false, includeIfNull: false)
  final String? visitTime;

  /// Visite : entreprise du visiteur.
  @JsonKey(name: r'entrepriseId', required: false, includeIfNull: false)
  final String? entrepriseId;

  /// Visite : objet de la visite.
  @JsonKey(name: r'objetId', required: false, includeIfNull: false)
  final String? objetId;

  /// Visite : direction ou étage visé.
  @JsonKey(name: r'directionId', required: false, includeIfNull: false)
  final String? directionId;

  /// Visite : destinataire visé.
  @JsonKey(name: r'destinataireId', required: false, includeIfNull: false)
  final String? destinataireId;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SyncEntityDataDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                fullName,
                nom,
                prenom,
                phone,
                departementId,
                iefId,
                banqueId,
                syndicatId,
                representantId,
                body,
                statut,
                notes,
                whatsappStatus,
                whatsappE164,
                profession,
                relationStatus,
                relationReason,
                etablissement,
                projet,
                type,
                dureeSystemeMois,
                canalProvenanceId,
                clientCreatedAt,
                prospectId,
                outcome,
                reasonCode,
                method,
                comment,
                callbackAt,
                email,
                fonctionnaire,
                engagementEnCours,
                dureeEtablissementMois,
                rendezVousAt,
                visitorName,
                visitDate,
                visitTime,
                entrepriseId,
                objetId,
                directionId,
                destinataireId,
              ],
              [
                other.fullName,
                other.nom,
                other.prenom,
                other.phone,
                other.departementId,
                other.iefId,
                other.banqueId,
                other.syndicatId,
                other.representantId,
                other.body,
                other.statut,
                other.notes,
                other.whatsappStatus,
                other.whatsappE164,
                other.profession,
                other.relationStatus,
                other.relationReason,
                other.etablissement,
                other.projet,
                other.type,
                other.dureeSystemeMois,
                other.canalProvenanceId,
                other.clientCreatedAt,
                other.prospectId,
                other.outcome,
                other.reasonCode,
                other.method,
                other.comment,
                other.callbackAt,
                other.email,
                other.fonctionnaire,
                other.engagementEnCours,
                other.dureeEtablissementMois,
                other.rendezVousAt,
                other.visitorName,
                other.visitDate,
                other.visitTime,
                other.entrepriseId,
                other.objetId,
                other.directionId,
                other.destinataireId,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        fullName,
        nom,
        prenom,
        phone,
        departementId,
        iefId,
        banqueId,
        syndicatId,
        representantId,
        body,
        statut,
        notes,
        whatsappStatus,
        whatsappE164,
        profession,
        relationStatus,
        relationReason,
        etablissement,
        projet,
        type,
        dureeSystemeMois,
        canalProvenanceId,
        clientCreatedAt,
        prospectId,
        outcome,
        reasonCode,
        method,
        comment,
        callbackAt,
        email,
        fonctionnaire,
        engagementEnCours,
        dureeEtablissementMois,
        rendezVousAt,
        visitorName,
        visitDate,
        visitTime,
        entrepriseId,
        objetId,
        directionId,
        destinataireId,
      ]);

  factory SyncEntityDataDto.fromJson(Map<String, dynamic> json) =>
      _$SyncEntityDataDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncEntityDataDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
