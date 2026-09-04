//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/rep_call_outcome.dart';
import 'package:crm_api_client/src/model/representant_relation.dart';
import 'package:crm_api_client/src/model/whatsapp_status.dart';
import 'package:crm_api_client/src/model/statut_qualification_effect.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantDto {
  /// Returns a new [RepresentantDto] instance.
  RepresentantDto({
    required this.id,

    required this.fullName,

    required this.phoneE164,

    required this.notes,

    required this.rev,

    required this.departementId,

    required this.departementName,

    required this.iefId,

    required this.iefName,

    required this.createdById,

    required this.createdByName,

    required this.clientCreatedAt,

    required this.createdAt,

    required this.updatedAt,

    required this.prospectCount,

    required this.relationStatus,

    required this.statutQualificationId,

    required this.statutQualificationLabel,

    required this.statutQualificationEffect,

    required this.whatsappStatus,

    required this.whatsappE164,

    required this.whatsappNumber,

    required this.profession,

    required this.prenom,

    required this.etablissement,

    required this.syndicat,

    required this.connaitUES,

    required this.contacte,

    required this.lastCallOutcome,

    required this.lastCallAt,

    required this.callAttemptCount,

    required this.lastCallById,

    required this.lastCallByName,

    required this.nextCallbackAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'fullName', required: true, includeIfNull: false)
  final String fullName;

  /// Téléphone normalisé E.164.
  @JsonKey(name: r'phoneE164', required: true, includeIfNull: false)
  final String phoneE164;

  @JsonKey(name: r'notes', required: true, includeIfNull: true)
  final String? notes;

  /// Révision serveur, incrémentée à chaque écriture.
  @JsonKey(name: r'rev', required: true, includeIfNull: false)
  final num rev;

  @JsonKey(name: r'departementId', required: true, includeIfNull: false)
  final String departementId;

  @JsonKey(name: r'departementName', required: true, includeIfNull: false)
  final String departementName;

  @JsonKey(name: r'iefId', required: true, includeIfNull: true)
  final String? iefId;

  @JsonKey(name: r'iefName', required: true, includeIfNull: true)
  final String? iefName;

  @JsonKey(name: r'createdById', required: true, includeIfNull: false)
  final String createdById;

  @JsonKey(name: r'createdByName', required: true, includeIfNull: false)
  final String createdByName;

  @JsonKey(name: r'clientCreatedAt', required: true, includeIfNull: false)
  final DateTime clientCreatedAt;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  @JsonKey(name: r'prospectCount', required: true, includeIfNull: false)
  final num prospectCount;

  @JsonKey(
    name: r'relationStatus',
    required: true,
    includeIfNull: false,
    unknownEnumValue: RepresentantRelation.unknownDefaultOpenApi,
  )
  final RepresentantRelation relationStatus;

  @JsonKey(name: r'statutQualificationId', required: true, includeIfNull: true)
  final String? statutQualificationId;

  /// Libellé du statut de qualification, affiché à la place de `relationStatus`. Nul sur une fiche jamais qualifiée.
  @JsonKey(
    name: r'statutQualificationLabel',
    required: true,
    includeIfNull: true,
  )
  final String? statutQualificationLabel;

  /// Effet du statut : c’est lui qui colore la pastille.
  @JsonKey(
    name: r'statutQualificationEffect',
    required: true,
    includeIfNull: true,
    unknownEnumValue: StatutQualificationEffect.unknownDefaultOpenApi,
  )
  final StatutQualificationEffect? statutQualificationEffect;

  @JsonKey(
    name: r'whatsappStatus',
    required: true,
    includeIfNull: false,
    unknownEnumValue: WhatsappStatus.unknownDefaultOpenApi,
  )
  final WhatsappStatus whatsappStatus;

  /// Renseigné avec le seul statut AUTRE_NUMERO.
  @JsonKey(name: r'whatsappE164', required: true, includeIfNull: true)
  final String? whatsappE164;

  /// Numéro joignable sur WhatsApp, recomposé : `phoneE164` sur MEME_NUMERO, `whatsappE164` sur AUTRE_NUMERO, nul sinon.
  @JsonKey(name: r'whatsappNumber', required: true, includeIfNull: true)
  final String? whatsappNumber;

  @JsonKey(name: r'profession', required: true, includeIfNull: true)
  final String? profession;

  @JsonKey(name: r'prenom', required: true, includeIfNull: true)
  final String? prenom;

  @JsonKey(name: r'etablissement', required: true, includeIfNull: true)
  final String? etablissement;

  @JsonKey(name: r'syndicat', required: true, includeIfNull: true)
  final String? syndicat;

  @JsonKey(name: r'connaitUES', required: true, includeIfNull: true)
  final bool? connaitUES;

  @JsonKey(name: r'contacte', required: true, includeIfNull: true)
  final bool? contacte;

  /// Issue du dernier appel. Nul : jamais appelé.
  @JsonKey(
    name: r'lastCallOutcome',
    required: true,
    includeIfNull: true,
    unknownEnumValue: RepCallOutcome.unknownDefaultOpenApi,
  )
  final RepCallOutcome? lastCallOutcome;

  @JsonKey(name: r'lastCallAt', required: true, includeIfNull: true)
  final DateTime? lastCallAt;

  /// Nombre d’appels consignés sur cette fiche.
  @JsonKey(name: r'callAttemptCount', required: true, includeIfNull: false)
  final num callAttemptCount;

  @JsonKey(name: r'lastCallById', required: true, includeIfNull: true)
  final String? lastCallById;

  @JsonKey(name: r'lastCallByName', required: true, includeIfNull: true)
  final String? lastCallByName;

  /// Rappel promis par le dernier appel, tant qu’aucun appel ne l’a honoré.
  @JsonKey(name: r'nextCallbackAt', required: true, includeIfNull: true)
  final DateTime? nextCallbackAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepresentantDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                fullName,
                phoneE164,
                notes,
                rev,
                departementId,
                departementName,
                iefId,
                iefName,
                createdById,
                createdByName,
                clientCreatedAt,
                createdAt,
                updatedAt,
                prospectCount,
                relationStatus,
                statutQualificationId,
                statutQualificationLabel,
                statutQualificationEffect,
                whatsappStatus,
                whatsappE164,
                whatsappNumber,
                profession,
                prenom,
                etablissement,
                syndicat,
                connaitUES,
                contacte,
                lastCallOutcome,
                lastCallAt,
                callAttemptCount,
                lastCallById,
                lastCallByName,
                nextCallbackAt,
              ],
              [
                other.id,
                other.fullName,
                other.phoneE164,
                other.notes,
                other.rev,
                other.departementId,
                other.departementName,
                other.iefId,
                other.iefName,
                other.createdById,
                other.createdByName,
                other.clientCreatedAt,
                other.createdAt,
                other.updatedAt,
                other.prospectCount,
                other.relationStatus,
                other.statutQualificationId,
                other.statutQualificationLabel,
                other.statutQualificationEffect,
                other.whatsappStatus,
                other.whatsappE164,
                other.whatsappNumber,
                other.profession,
                other.prenom,
                other.etablissement,
                other.syndicat,
                other.connaitUES,
                other.contacte,
                other.lastCallOutcome,
                other.lastCallAt,
                other.callAttemptCount,
                other.lastCallById,
                other.lastCallByName,
                other.nextCallbackAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        fullName,
        phoneE164,
        notes,
        rev,
        departementId,
        departementName,
        iefId,
        iefName,
        createdById,
        createdByName,
        clientCreatedAt,
        createdAt,
        updatedAt,
        prospectCount,
        relationStatus,
        statutQualificationId,
        statutQualificationLabel,
        statutQualificationEffect,
        whatsappStatus,
        whatsappE164,
        whatsappNumber,
        profession,
        prenom,
        etablissement,
        syndicat,
        connaitUES,
        contacte,
        lastCallOutcome,
        lastCallAt,
        callAttemptCount,
        lastCallById,
        lastCallByName,
        nextCallbackAt,
      ]);

  factory RepresentantDto.fromJson(Map<String, dynamic> json) =>
      _$RepresentantDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
