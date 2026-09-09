//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/representant_relation.dart';
import 'package:crm_api_client/src/model/whatsapp_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_representant_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateRepresentantDto {
  /// Returns a new [UpdateRepresentantDto] instance.
  UpdateRepresentantDto({
    this.id,

    this.fullName,

    this.prenom,

    this.etablissement,

    this.phone,

    this.departementId,

    this.iefId,

    this.notes,

    this.clientCreatedAt,

    this.relationStatus,

    this.relationReason,

    this.whatsappStatus,

    this.whatsappE164,

    this.profession,

    this.syndicat,

    this.connaitUES,

    this.contacte,
  });

  /// Identifiant UUID v7 généré par le client. Fourni par le mobile pour que les prospects saisis hors ligne puissent le référencer avant toute synchronisation.
  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'fullName', required: false, includeIfNull: false)
  final String? fullName;

  /// Prénom, quand il a été recueilli séparément du nom complet.
  @JsonKey(name: r'prenom', required: false, includeIfNull: false)
  final String? prenom;

  /// Établissement où il exerce. Ni l’IEF ni le département.
  @JsonKey(name: r'etablissement', required: false, includeIfNull: false)
  final String? etablissement;

  /// Téléphone en saisie libre. Normalisé en E.164 par le serveur.
  @JsonKey(name: r'phone', required: false, includeIfNull: false)
  final String? phone;

  @JsonKey(name: r'departementId', required: false, includeIfNull: false)
  final String? departementId;

  /// IEF de rattachement. FACULTATIVE : les fiches saisies avant l’arrivée de ce référentiel n’en portent pas, et la rendre obligatoire les invaliderait rétroactivement. Le département reste obligatoire, il se déduit de l’IEF, jamais l’inverse.
  @JsonKey(name: r'iefId', required: false, includeIfNull: false)
  final String? iefId;

  @JsonKey(name: r'notes', required: false, includeIfNull: false)
  final String? notes;

  /// Horodatage de la saisie sur le terrain. Défaut : maintenant. Distinct de createdAt, qui est l’arrivée en base.
  @JsonKey(name: r'clientCreatedAt', required: false, includeIfNull: false)
  final DateTime? clientCreatedAt;

  /// État de la relation. Chaque bascule est historisée ; reposter le même statut n’écrit rien.
  @JsonKey(
    name: r'relationStatus',
    required: false,
    includeIfNull: false,
    unknownEnumValue: RepresentantRelation.unknownDefaultOpenApi,
  )
  final RepresentantRelation? relationStatus;

  /// Motif de la bascule, repris dans la chronologie. Sans effet quand `relationStatus` est absent ou reposte le statut courant.
  @JsonKey(name: r'relationReason', required: false, includeIfNull: false)
  final String? relationReason;

  /// Trois états et non un booléen : NON_DEMANDE dit que la question n’a pas été posée, AUCUN qu’elle l’a été et que la réponse est non.
  @JsonKey(
    name: r'whatsappStatus',
    required: false,
    includeIfNull: false,
    unknownEnumValue: WhatsappStatus.unknownDefaultOpenApi,
  )
  final WhatsappStatus? whatsappStatus;

  /// Numéro WhatsApp DISTINCT du téléphone. Saisie libre, normalisé par le serveur. Admis avec le seul statut AUTRE_NUMERO : sur MEME_NUMERO le numéro se relit sur `phoneE164`.
  @JsonKey(name: r'whatsappE164', required: false, includeIfNull: false)
  final String? whatsappE164;

  /// Profession, en texte libre. Chaîne vide : la valeur est effacée.
  @JsonKey(name: r'profession', required: false, includeIfNull: false)
  final String? profession;

  /// Niveau de syndicat déclaré pendant la qualification. Texte libre, distinct du référentiel Syndicat des prospects. Chaîne vide : la valeur est effacée.
  @JsonKey(name: r'syndicat', required: false, includeIfNull: false)
  final String? syndicat;

  /// Le représentant déclare connaître l’UES.
  @JsonKey(name: r'connaitUES', required: false, includeIfNull: false)
  final bool? connaitUES;

  /// Le représentant déclare avoir déjà été contacté. Distinct de relationStatus, qui porte la décision ambassadeur/refus.
  @JsonKey(name: r'contacte', required: false, includeIfNull: false)
  final bool? contacte;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateRepresentantDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                fullName,
                prenom,
                etablissement,
                phone,
                departementId,
                iefId,
                notes,
                clientCreatedAt,
                relationStatus,
                relationReason,
                whatsappStatus,
                whatsappE164,
                profession,
                syndicat,
                connaitUES,
                contacte,
              ],
              [
                other.id,
                other.fullName,
                other.prenom,
                other.etablissement,
                other.phone,
                other.departementId,
                other.iefId,
                other.notes,
                other.clientCreatedAt,
                other.relationStatus,
                other.relationReason,
                other.whatsappStatus,
                other.whatsappE164,
                other.profession,
                other.syndicat,
                other.connaitUES,
                other.contacte,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        fullName,
        prenom,
        etablissement,
        phone,
        departementId,
        iefId,
        notes,
        clientCreatedAt,
        relationStatus,
        relationReason,
        whatsappStatus,
        whatsappE164,
        profession,
        syndicat,
        connaitUES,
        contacte,
      ]);

  factory UpdateRepresentantDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateRepresentantDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateRepresentantDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
