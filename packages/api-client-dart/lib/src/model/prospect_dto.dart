//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/payment_mode.dart';
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/prospect_type.dart';
import 'package:crm_api_client/src/model/call_outcome.dart';
import 'package:crm_api_client/src/model/bdd_segment.dart';
import 'package:crm_api_client/src/model/phase2_status.dart';
import 'package:crm_api_client/src/model/prospect_journey_dto.dart';
import 'package:crm_api_client/src/model/prospect_statut.dart';
import 'package:crm_api_client/src/model/enrollment_method.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'prospect_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProspectDto {
  /// Returns a new [ProspectDto] instance.
  ProspectDto({
    required this.id,

    required this.nom,

    required this.prenom,

    required this.phoneE164,

    required this.rev,

    required this.statut,

    required this.projet,

    required this.banqueId,

    required this.banqueName,

    required this.syndicatId,

    required this.syndicatSigle,

    required this.representantId,

    required this.representantName,

    required this.representantPhoneE164,

    required this.departementId,

    required this.departementName,

    required this.ownedByCommercialId,

    required this.ownedByCommercialName,

    required this.type,

    required this.profession,

    required this.professionId,

    required this.professionIsTeaching,

    required this.incomeBandId,

    required this.incomeBandLabel,

    required this.paymentMode,

    required this.journeys,

    required this.dureeSystemeMois,

    required this.canalProvenanceId,

    required this.canalProvenanceLabel,

    required this.segment,

    required this.phase2Status,

    required this.enrollmentMethod,

    required this.enrollmentCapturedById,

    required this.enrollmentCapturedByName,

    required this.enrollmentCapturedAt,

    required this.lastOutcome,

    required this.lastComment,

    required this.lastAttemptAt,

    required this.origin,

    required this.originLabel,

    required this.clientCreatedAt,

    required this.createdAt,

    required this.updatedAt,

    required this.deletedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'nom', required: true, includeIfNull: false)
  final String nom;

  @JsonKey(name: r'prenom', required: true, includeIfNull: false)
  final String prenom;

  @JsonKey(name: r'phoneE164', required: true, includeIfNull: false)
  final String phoneE164;

  @JsonKey(name: r'rev', required: true, includeIfNull: false)
  final num rev;

  @JsonKey(
    name: r'statut',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ProspectStatut.unknownDefaultOpenApi,
  )
  final ProspectStatut statut;

  @JsonKey(
    name: r'projet',
    required: true,
    includeIfNull: false,
    unknownEnumValue: Projet.unknownDefaultOpenApi,
  )
  final Projet projet;

  @JsonKey(name: r'banqueId', required: true, includeIfNull: true)
  final String? banqueId;

  @JsonKey(name: r'banqueName', required: true, includeIfNull: true)
  final String? banqueName;

  @JsonKey(name: r'syndicatId', required: true, includeIfNull: true)
  final String? syndicatId;

  @JsonKey(name: r'syndicatSigle', required: true, includeIfNull: true)
  final String? syndicatSigle;

  @JsonKey(name: r'representantId', required: true, includeIfNull: true)
  final String? representantId;

  @JsonKey(name: r'representantName', required: true, includeIfNull: true)
  final String? representantName;

  @JsonKey(name: r'representantPhoneE164', required: true, includeIfNull: true)
  final String? representantPhoneE164;

  @JsonKey(name: r'departementId', required: true, includeIfNull: true)
  final String? departementId;

  @JsonKey(name: r'departementName', required: true, includeIfNull: true)
  final String? departementName;

  @JsonKey(name: r'ownedByCommercialId', required: true, includeIfNull: false)
  final String ownedByCommercialId;

  @JsonKey(name: r'ownedByCommercialName', required: true, includeIfNull: false)
  final String ownedByCommercialName;

  /// Hors CHUES : ce qu’est le prospect. Nul si la question n’a pas été posée.
  @JsonKey(
    name: r'type',
    required: true,
    includeIfNull: true,
    unknownEnumValue: ProspectType.unknownDefaultOpenApi,
  )
  final ProspectType? type;

  /// Métier déclaré, en clair.
  @JsonKey(name: r'profession', required: true, includeIfNull: true)
  final String? profession;

  @JsonKey(name: r'professionId', required: true, includeIfNull: true)
  final String? professionId;

  @JsonKey(name: r'professionIsTeaching', required: true, includeIfNull: true)
  final bool? professionIsTeaching;

  @JsonKey(name: r'incomeBandId', required: true, includeIfNull: true)
  final String? incomeBandId;

  @JsonKey(name: r'incomeBandLabel', required: true, includeIfNull: true)
  final String? incomeBandLabel;

  @JsonKey(
    name: r'paymentMode',
    required: true,
    includeIfNull: true,
    unknownEnumValue: PaymentMode.unknownDefaultOpenApi,
  )
  final PaymentMode? paymentMode;

  @JsonKey(name: r'journeys', required: true, includeIfNull: false)
  final List<ProspectJourneyDto> journeys;

  /// Durée du système de paiement retenue, en MOIS.
  @JsonKey(name: r'dureeSystemeMois', required: true, includeIfNull: true)
  final num? dureeSystemeMois;

  @JsonKey(name: r'canalProvenanceId', required: true, includeIfNull: true)
  final String? canalProvenanceId;

  /// Par où le prospect est arrivé. Référentiel ouvert.
  @JsonKey(name: r'canalProvenanceLabel', required: true, includeIfNull: true)
  final String? canalProvenanceLabel;

  /// Calculé par croisement syndicat × banque, jamais stocké. NUL dès qu’il manque l’un des deux : le segment ne se devine pas.
  @JsonKey(
    name: r'segment',
    required: true,
    includeIfNull: true,
    unknownEnumValue: BddSegment.unknownDefaultOpenApi,
  )
  final BddSegment? segment;

  @JsonKey(
    name: r'phase2Status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: Phase2Status.unknownDefaultOpenApi,
  )
  final Phase2Status phase2Status;

  /// Renseignée si et seulement si `phase2Status` vaut METHOD_OBTAINED.
  @JsonKey(
    name: r'enrollmentMethod',
    required: true,
    includeIfNull: true,
    unknownEnumValue: EnrollmentMethod.unknownDefaultOpenApi,
  )
  final EnrollmentMethod? enrollmentMethod;

  /// Commercial ayant OBTENU la méthode, distinct de `ownedByCommercialId` qui a fait la saisie de phase 1.
  @JsonKey(name: r'enrollmentCapturedById', required: true, includeIfNull: true)
  final String? enrollmentCapturedById;

  @JsonKey(
    name: r'enrollmentCapturedByName',
    required: true,
    includeIfNull: true,
  )
  final String? enrollmentCapturedByName;

  @JsonKey(name: r'enrollmentCapturedAt', required: true, includeIfNull: true)
  final DateTime? enrollmentCapturedAt;

  /// Résultat de la dernière tentative d’appel enregistrée.
  @JsonKey(
    name: r'lastOutcome',
    required: true,
    includeIfNull: true,
    unknownEnumValue: CallOutcome.unknownDefaultOpenApi,
  )
  final CallOutcome? lastOutcome;

  /// Commentaire de cette tentative.
  @JsonKey(name: r'lastComment', required: true, includeIfNull: true)
  final String? lastComment;

  @JsonKey(name: r'lastAttemptAt', required: true, includeIfNull: true)
  final DateTime? lastAttemptAt;

  /// Clé de provenance. Nulle pour une fiche née d’une tournée terrain.
  @JsonKey(name: r'origin', required: true, includeIfNull: true)
  final String? origin;

  /// Détail conservé à la création (nom de la banque demandeuse, par exemple).
  @JsonKey(name: r'originLabel', required: true, includeIfNull: true)
  final String? originLabel;

  @JsonKey(name: r'clientCreatedAt', required: true, includeIfNull: false)
  final DateTime clientCreatedAt;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  @JsonKey(name: r'deletedAt', required: true, includeIfNull: true)
  final DateTime? deletedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ProspectDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                nom,
                prenom,
                phoneE164,
                rev,
                statut,
                projet,
                banqueId,
                banqueName,
                syndicatId,
                syndicatSigle,
                representantId,
                representantName,
                representantPhoneE164,
                departementId,
                departementName,
                ownedByCommercialId,
                ownedByCommercialName,
                type,
                profession,
                professionId,
                professionIsTeaching,
                incomeBandId,
                incomeBandLabel,
                paymentMode,
                journeys,
                dureeSystemeMois,
                canalProvenanceId,
                canalProvenanceLabel,
                segment,
                phase2Status,
                enrollmentMethod,
                enrollmentCapturedById,
                enrollmentCapturedByName,
                enrollmentCapturedAt,
                lastOutcome,
                lastComment,
                lastAttemptAt,
                origin,
                originLabel,
                clientCreatedAt,
                createdAt,
                updatedAt,
                deletedAt,
              ],
              [
                other.id,
                other.nom,
                other.prenom,
                other.phoneE164,
                other.rev,
                other.statut,
                other.projet,
                other.banqueId,
                other.banqueName,
                other.syndicatId,
                other.syndicatSigle,
                other.representantId,
                other.representantName,
                other.representantPhoneE164,
                other.departementId,
                other.departementName,
                other.ownedByCommercialId,
                other.ownedByCommercialName,
                other.type,
                other.profession,
                other.professionId,
                other.professionIsTeaching,
                other.incomeBandId,
                other.incomeBandLabel,
                other.paymentMode,
                other.journeys,
                other.dureeSystemeMois,
                other.canalProvenanceId,
                other.canalProvenanceLabel,
                other.segment,
                other.phase2Status,
                other.enrollmentMethod,
                other.enrollmentCapturedById,
                other.enrollmentCapturedByName,
                other.enrollmentCapturedAt,
                other.lastOutcome,
                other.lastComment,
                other.lastAttemptAt,
                other.origin,
                other.originLabel,
                other.clientCreatedAt,
                other.createdAt,
                other.updatedAt,
                other.deletedAt,
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
        phoneE164,
        rev,
        statut,
        projet,
        banqueId,
        banqueName,
        syndicatId,
        syndicatSigle,
        representantId,
        representantName,
        representantPhoneE164,
        departementId,
        departementName,
        ownedByCommercialId,
        ownedByCommercialName,
        type,
        profession,
        professionId,
        professionIsTeaching,
        incomeBandId,
        incomeBandLabel,
        paymentMode,
        journeys,
        dureeSystemeMois,
        canalProvenanceId,
        canalProvenanceLabel,
        segment,
        phase2Status,
        enrollmentMethod,
        enrollmentCapturedById,
        enrollmentCapturedByName,
        enrollmentCapturedAt,
        lastOutcome,
        lastComment,
        lastAttemptAt,
        origin,
        originLabel,
        clientCreatedAt,
        createdAt,
        updatedAt,
        deletedAt,
      ]);

  factory ProspectDto.fromJson(Map<String, dynamic> json) =>
      _$ProspectDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ProspectDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
