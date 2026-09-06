//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/payment_mode.dart';
import 'package:crm_api_client/src/model/prospect_type.dart';
import 'package:crm_api_client/src/model/whatsapp_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'demande_publique_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DemandePubliqueDto {
  /// Returns a new [DemandePubliqueDto] instance.
  DemandePubliqueDto({
    required this.nom,

    required this.prenom,

    required this.phone,

    this.email,

    this.profession,

    this.etablissement,

    this.employeur,

    this.dureeEtablissementMois,

    this.fonctionnaire,

    this.engagementEnCours,

    this.syndicatId,

    this.banqueId,

    this.incomeBandId,

    this.type,

    this.paymentMode,

    this.dureeSystemeMois,

    this.whatsappStatus,

    this.whatsappE164,

    this.champsLibres,

    this.message,

    this.site,

    this.turnstileToken,
  });

  @JsonKey(name: r'nom', required: true, includeIfNull: false)
  final String nom;

  @JsonKey(name: r'prenom', required: true, includeIfNull: false)
  final String prenom;

  /// Saisie libre, normalisé en E.164 par le serveur.
  @JsonKey(name: r'phone', required: true, includeIfNull: false)
  final String phone;

  /// Sans adresse, la confirmation à l’écran vaut accusé de réception. Sert aussi à rapprocher la demande d’une fiche existante quand le numéro est inconnu.
  @JsonKey(name: r'email', required: false, includeIfNull: false)
  final String? email;

  @JsonKey(name: r'profession', required: false, includeIfNull: false)
  final String? profession;

  /// Établissement où le visiteur exerce.
  @JsonKey(name: r'etablissement', required: false, includeIfNull: false)
  final String? etablissement;

  /// Conservé pour les pages déjà en ligne. `etablissement` le remplace.
  @Deprecated('employeur has been deprecated')
  @JsonKey(name: r'employeur', required: false, includeIfNull: false)
  final String? employeur;

  // minimum: 0
  // maximum: 600
  @JsonKey(
    name: r'dureeEtablissementMois',
    required: false,
    includeIfNull: false,
  )
  final num? dureeEtablissementMois;

  @JsonKey(name: r'fonctionnaire', required: false, includeIfNull: false)
  final bool? fonctionnaire;

  @JsonKey(name: r'engagementEnCours', required: false, includeIfNull: false)
  final bool? engagementEnCours;

  /// Identifiant rendu par `GET /formulaire`.
  @JsonKey(name: r'syndicatId', required: false, includeIfNull: false)
  final String? syndicatId;

  /// Identifiant rendu par `GET /formulaire`.
  @JsonKey(name: r'banqueId', required: false, includeIfNull: false)
  final String? banqueId;

  /// Identifiant rendu par `GET /formulaire`.
  @JsonKey(name: r'incomeBandId', required: false, includeIfNull: false)
  final String? incomeBandId;

  @JsonKey(
    name: r'type',
    required: false,
    includeIfNull: false,
    unknownEnumValue: ProspectType.unknownDefaultOpenApi,
  )
  final ProspectType? type;

  @JsonKey(
    name: r'paymentMode',
    required: false,
    includeIfNull: false,
    unknownEnumValue: PaymentMode.unknownDefaultOpenApi,
  )
  final PaymentMode? paymentMode;

  // minimum: 1
  // maximum: 300
  @JsonKey(name: r'dureeSystemeMois', required: false, includeIfNull: false)
  final num? dureeSystemeMois;

  @JsonKey(
    name: r'whatsappStatus',
    required: false,
    includeIfNull: false,
    unknownEnumValue: WhatsappStatus.unknownDefaultOpenApi,
  )
  final WhatsappStatus? whatsappStatus;

  /// Exigé quand le statut vaut AUTRE_NUMERO.
  @JsonKey(name: r'whatsappE164', required: false, includeIfNull: false)
  final String? whatsappE164;

  /// Réponses aux champs ajoutés par l’administrateur, par identifiant de champ.
  @JsonKey(name: r'champsLibres', required: false, includeIfNull: false)
  final Map<String, String>? champsLibres;

  @JsonKey(name: r'message', required: false, includeIfNull: false)
  final String? message;

  /// Laisser vide.
  @JsonKey(name: r'site', required: false, includeIfNull: false)
  final String? site;

  /// Jeton rendu par le widget Cloudflare Turnstile de la page.
  @JsonKey(name: r'turnstileToken', required: false, includeIfNull: false)
  final String? turnstileToken;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DemandePubliqueDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                nom,
                prenom,
                phone,
                email,
                profession,
                etablissement,
                employeur,
                dureeEtablissementMois,
                fonctionnaire,
                engagementEnCours,
                syndicatId,
                banqueId,
                incomeBandId,
                type,
                paymentMode,
                dureeSystemeMois,
                whatsappStatus,
                whatsappE164,
                champsLibres,
                message,
                site,
                turnstileToken,
              ],
              [
                other.nom,
                other.prenom,
                other.phone,
                other.email,
                other.profession,
                other.etablissement,
                other.employeur,
                other.dureeEtablissementMois,
                other.fonctionnaire,
                other.engagementEnCours,
                other.syndicatId,
                other.banqueId,
                other.incomeBandId,
                other.type,
                other.paymentMode,
                other.dureeSystemeMois,
                other.whatsappStatus,
                other.whatsappE164,
                other.champsLibres,
                other.message,
                other.site,
                other.turnstileToken,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        nom,
        prenom,
        phone,
        email,
        profession,
        etablissement,
        employeur,
        dureeEtablissementMois,
        fonctionnaire,
        engagementEnCours,
        syndicatId,
        banqueId,
        incomeBandId,
        type,
        paymentMode,
        dureeSystemeMois,
        whatsappStatus,
        whatsappE164,
        champsLibres,
        message,
        site,
        turnstileToken,
      ]);

  factory DemandePubliqueDto.fromJson(Map<String, dynamic> json) =>
      _$DemandePubliqueDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DemandePubliqueDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
