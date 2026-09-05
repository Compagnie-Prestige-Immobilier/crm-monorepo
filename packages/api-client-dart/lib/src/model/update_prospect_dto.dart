//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/mode_epargne.dart';
import 'package:crm_api_client/src/model/payment_mode.dart';
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/prospect_type.dart';
import 'package:crm_api_client/src/model/prospect_statut.dart';
import 'package:crm_api_client/src/model/type_contrat.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_prospect_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateProspectDto {
  /// Returns a new [UpdateProspectDto] instance.
  UpdateProspectDto({

     this.id,

     this.nom,

     this.prenom,

     this.phone,

     this.representantId,

     this.projet,

     this.type,

     this.profession,

     this.paymentMode,

     this.dureeSystemeMois,

     this.statut,

     this.clientCreatedAt,

     this.banqueId,

     this.syndicatId,

     this.professionId,

     this.incomeBandId,

     this.canalProvenanceId,

     this.employeurId,

     this.employeur,

     this.typeContrat,

     this.ancienneteMois,

     this.lieuActivite,

     this.modeEpargne,

     this.paysResidenceId,

     this.villeResidence,

     this.whatsappE164,

     this.relaisNom,

     this.relaisPhoneE164,
  });

      /// Identifiant UUID v7 généré par le client. Généré côté serveur s’il est absent.
  @JsonKey(
    
    name: r'id',
    required: false,
    includeIfNull: false,
  )


  final String? id;



  @JsonKey(
    
    name: r'nom',
    required: false,
    includeIfNull: false,
  )


  final String? nom;



  @JsonKey(
    
    name: r'prenom',
    required: false,
    includeIfNull: false,
  )


  final String? prenom;



      /// Téléphone en saisie libre. Normalisé en E.164 par le serveur.
  @JsonKey(
    
    name: r'phone',
    required: false,
    includeIfNull: false,
  )


  final String? phone;



  @JsonKey(
    
    name: r'representantId',
    required: false,
    includeIfNull: false,
  )


  final String? representantId;



      /// CHUES par défaut. Les deux projets ne se mélangent nulle part.
  @JsonKey(
    
    name: r'projet',
    required: false,
    includeIfNull: false,
  unknownEnumValue: Projet.unknownDefaultOpenApi,
  )


  final Projet? projet;



  @JsonKey(
    
    name: r'type',
    required: false,
    includeIfNull: false,
  unknownEnumValue: ProspectType.unknownDefaultOpenApi,
  )


  final ProspectType? type;



      /// Métier déclaré, en clair.
  @JsonKey(
    
    name: r'profession',
    required: false,
    includeIfNull: false,
  )


  final String? profession;



  @JsonKey(
    
    name: r'paymentMode',
    required: false,
    includeIfNull: false,
  unknownEnumValue: PaymentMode.unknownDefaultOpenApi,
  )


  final PaymentMode? paymentMode;



      /// Durée du système de paiement, en MOIS.
          // minimum: 1
          // maximum: 300
  @JsonKey(
    
    name: r'dureeSystemeMois',
    required: false,
    includeIfNull: false,
  )


  final num? dureeSystemeMois;



  @JsonKey(
    
    name: r'statut',
    required: false,
    includeIfNull: false,
  unknownEnumValue: ProspectStatut.unknownDefaultOpenApi,
  )


  final ProspectStatut? statut;



      /// Horodatage de la saisie terrain.
  @JsonKey(
    
    name: r'clientCreatedAt',
    required: false,
    includeIfNull: false,
  )


  final DateTime? clientCreatedAt;



  @JsonKey(
    
    name: r'banqueId',
    required: false,
    includeIfNull: false,
  )


  final String? banqueId;



  @JsonKey(
    
    name: r'syndicatId',
    required: false,
    includeIfNull: false,
  )


  final String? syndicatId;



  @JsonKey(
    
    name: r'professionId',
    required: false,
    includeIfNull: false,
  )


  final String? professionId;



  @JsonKey(
    
    name: r'incomeBandId',
    required: false,
    includeIfNull: false,
  )


  final String? incomeBandId;



  @JsonKey(
    
    name: r'canalProvenanceId',
    required: false,
    includeIfNull: false,
  )


  final String? canalProvenanceId;



  @JsonKey(
    
    name: r'employeurId',
    required: false,
    includeIfNull: false,
  )


  final String? employeurId;



  @JsonKey(
    
    name: r'employeur',
    required: false,
    includeIfNull: false,
  )


  final String? employeur;



  @JsonKey(
    
    name: r'typeContrat',
    required: false,
    includeIfNull: false,
  unknownEnumValue: TypeContrat.unknownDefaultOpenApi,
  )


  final TypeContrat? typeContrat;



          // minimum: 0
          // maximum: 840
  @JsonKey(
    
    name: r'ancienneteMois',
    required: false,
    includeIfNull: false,
  )


  final num? ancienneteMois;



  @JsonKey(
    
    name: r'lieuActivite',
    required: false,
    includeIfNull: false,
  )


  final String? lieuActivite;



  @JsonKey(
    
    name: r'modeEpargne',
    required: false,
    includeIfNull: false,
  unknownEnumValue: ModeEpargne.unknownDefaultOpenApi,
  )


  final ModeEpargne? modeEpargne;



  @JsonKey(
    
    name: r'paysResidenceId',
    required: false,
    includeIfNull: false,
  )


  final String? paysResidenceId;



  @JsonKey(
    
    name: r'villeResidence',
    required: false,
    includeIfNull: false,
  )


  final String? villeResidence;



  @JsonKey(
    
    name: r'whatsappE164',
    required: false,
    includeIfNull: false,
  )


  final String? whatsappE164;



  @JsonKey(
    
    name: r'relaisNom',
    required: false,
    includeIfNull: false,
  )


  final String? relaisNom;



  @JsonKey(
    
    name: r'relaisPhoneE164',
    required: false,
    includeIfNull: false,
  )


  final String? relaisPhoneE164;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is UpdateProspectDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            nom,
            prenom,
            phone,
            representantId,
            projet,
            type,
            profession,
            paymentMode,
            dureeSystemeMois,
            statut,
            clientCreatedAt,
            banqueId,
            syndicatId,
            professionId,
            incomeBandId,
            canalProvenanceId,
            employeurId,
            employeur,
            typeContrat,
            ancienneteMois,
            lieuActivite,
            modeEpargne,
            paysResidenceId,
            villeResidence,
            whatsappE164,
            relaisNom,
            relaisPhoneE164,
        ],
        [
            other.id,
            other.nom,
            other.prenom,
            other.phone,
            other.representantId,
            other.projet,
            other.type,
            other.profession,
            other.paymentMode,
            other.dureeSystemeMois,
            other.statut,
            other.clientCreatedAt,
            other.banqueId,
            other.syndicatId,
            other.professionId,
            other.incomeBandId,
            other.canalProvenanceId,
            other.employeurId,
            other.employeur,
            other.typeContrat,
            other.ancienneteMois,
            other.lieuActivite,
            other.modeEpargne,
            other.paysResidenceId,
            other.villeResidence,
            other.whatsappE164,
            other.relaisNom,
            other.relaisPhoneE164,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        nom,
        prenom,
        phone,
        representantId,
        projet,
        type,
        profession,
        paymentMode,
        dureeSystemeMois,
        statut,
        clientCreatedAt,
        banqueId,
        syndicatId,
        professionId,
        incomeBandId,
        canalProvenanceId,
        employeurId,
        employeur,
        typeContrat,
        ancienneteMois,
        lieuActivite,
        modeEpargne,
        paysResidenceId,
        villeResidence,
        whatsappE164,
        relaisNom,
        relaisPhoneE164,
    ],);

  factory UpdateProspectDto.fromJson(Map<String, dynamic> json) => _$UpdateProspectDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateProspectDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

