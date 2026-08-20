//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/rep_call_outcome.dart';
import 'package:crm_api_client/src/model/representant_relation.dart';
import 'package:crm_api_client/src/model/whatsapp_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_rep_call_attempt_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateRepCallAttemptDto {
  /// Returns a new [CreateRepCallAttemptDto] instance.
  CreateRepCallAttemptDto({
    required this.id,

    required this.representantId,

    required this.outcome,

    this.promisedProspects,

    this.comment,

    this.relationStatus,

    this.suggestedPhone,

    this.suggestedName,

    this.suggestedNote,

    this.whatsappStatus,

    this.whatsappE164,

    this.profession,

    required this.clientCreatedAt,
  });

  /// UUID v7 engendré par le client. Clé d’idempotence.
  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'representantId', required: true, includeIfNull: false)
  final String representantId;

  @JsonKey(
    name: r'outcome',
    required: true,
    includeIfNull: false,
    unknownEnumValue: RepCallOutcome.unknownDefaultOpenApi,
  )
  final RepCallOutcome outcome;

  /// Fiches promises. Admis uniquement pour l’issue PROSPECTS_PROMISED.
  // minimum: 0
  // maximum: 10000
  @JsonKey(name: r'promisedProspects', required: false, includeIfNull: false)
  final num? promisedProspects;

  /// Obligatoire et non vide si l’issue vaut OTHER.
  @JsonKey(name: r'comment', required: false, includeIfNull: false)
  final String? comment;

  /// État de la relation tel que l’appel vient de l’apprendre. Absent : le statut ne bouge pas. Identique au statut courant : rien n’est écrit.
  @JsonKey(
    name: r'relationStatus',
    required: false,
    includeIfNull: false,
    unknownEnumValue: RepresentantRelation.unknownDefaultOpenApi,
  )
  final RepresentantRelation? relationStatus;

  /// Numéro qu’un représentant qui refuse propose d’appeler à sa place. Saisie libre, normalisé par le serveur. Un numéro illisible refuse la tentative entière : le téléconseiller est sur l’écran au moment où il le tape.
  @JsonKey(name: r'suggestedPhone', required: false, includeIfNull: false)
  final String? suggestedPhone;

  /// Nom du contact suggéré, tel que dicté. Ignoré sans `suggestedPhone`.
  @JsonKey(name: r'suggestedName', required: false, includeIfNull: false)
  final String? suggestedName;

  /// Ce que le représentant dit du contact. Ignoré sans `suggestedPhone`.
  @JsonKey(name: r'suggestedNote', required: false, includeIfNull: false)
  final String? suggestedNote;

  /// Ce que l’appel apprend du canal WhatsApp. La question ne se pose qu’APRÈS l’engagement : NON_DEMANDE reste donc la réponse honnête tant qu’elle n’a pas été posée. Absent : l’état ne bouge pas.
  @JsonKey(
    name: r'whatsappStatus',
    required: false,
    includeIfNull: false,
    unknownEnumValue: WhatsappStatus.unknownDefaultOpenApi,
  )
  final WhatsappStatus? whatsappStatus;

  /// Numéro WhatsApp DISTINCT du téléphone. Saisie libre, normalisé par le serveur. Admis avec le seul statut AUTRE_NUMERO.
  @JsonKey(name: r'whatsappE164', required: false, includeIfNull: false)
  final String? whatsappE164;

  /// Profession, en texte libre. Chaîne vide : la valeur est effacée.
  @JsonKey(name: r'profession', required: false, includeIfNull: false)
  final String? profession;

  /// Horodatage de l’appel sur le terrain, distinct de son arrivée en base.
  @JsonKey(name: r'clientCreatedAt', required: true, includeIfNull: false)
  final DateTime clientCreatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateRepCallAttemptDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                representantId,
                outcome,
                promisedProspects,
                comment,
                relationStatus,
                suggestedPhone,
                suggestedName,
                suggestedNote,
                whatsappStatus,
                whatsappE164,
                profession,
                clientCreatedAt,
              ],
              [
                other.id,
                other.representantId,
                other.outcome,
                other.promisedProspects,
                other.comment,
                other.relationStatus,
                other.suggestedPhone,
                other.suggestedName,
                other.suggestedNote,
                other.whatsappStatus,
                other.whatsappE164,
                other.profession,
                other.clientCreatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        representantId,
        outcome,
        promisedProspects,
        comment,
        relationStatus,
        suggestedPhone,
        suggestedName,
        suggestedNote,
        whatsappStatus,
        whatsappE164,
        profession,
        clientCreatedAt,
      ]);

  factory CreateRepCallAttemptDto.fromJson(Map<String, dynamic> json) =>
      _$CreateRepCallAttemptDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateRepCallAttemptDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
