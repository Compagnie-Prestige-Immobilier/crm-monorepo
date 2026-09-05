//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/bank_rejection_reason_dto.dart';
import 'package:crm_api_client/src/model/bank_case_stage_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_case_transition_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankCaseTransitionDto {
  /// Returns a new [BankCaseTransitionDto] instance.
  BankCaseTransitionDto({

    required  this.id,

    required  this.caseId,

    required  this.fromStage,

    required  this.toStage,

    required  this.performedById,

    required  this.performedByName,

    required  this.amountXof,

    required  this.rejectionReason,

    required  this.rejectionDetail,

    required  this.comment,

    required  this.correctionReason,

    required  this.createdAt,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'caseId',
    required: true,
    includeIfNull: false,
  )


  final String caseId;



      /// Nul pour la transition de création.
  @JsonKey(
    
    name: r'fromStage',
    required: true,
    includeIfNull: true,
  )


  final BankCaseStageDto? fromStage;



  @JsonKey(
    
    name: r'toStage',
    required: true,
    includeIfNull: false,
  )


  final BankCaseStageDto toStage;



  @JsonKey(
    
    name: r'performedById',
    required: true,
    includeIfNull: false,
  )


  final String performedById;



  @JsonKey(
    
    name: r'performedByName',
    required: true,
    includeIfNull: false,
  )


  final String performedByName;



      /// Montant en francs CFA, entier, exposé en chaîne. XOF n’a pas de décimales et un nombre JSON perdrait de la précision au-delà de 2^53.
  @JsonKey(
    
    name: r'amountXof',
    required: true,
    includeIfNull: true,
  )


  final String? amountXof;



  @JsonKey(
    
    name: r'rejectionReason',
    required: true,
    includeIfNull: true,
  )


  final BankRejectionReasonDto? rejectionReason;



  @JsonKey(
    
    name: r'rejectionDetail',
    required: true,
    includeIfNull: true,
  )


  final String? rejectionDetail;



  @JsonKey(
    
    name: r'comment',
    required: true,
    includeIfNull: true,
  )


  final String? comment;



      /// Renseigné uniquement quand un ADMIN corrige un dossier terminal. Sa présence distingue une correction d’une avancée normale.
  @JsonKey(
    
    name: r'correctionReason',
    required: true,
    includeIfNull: true,
  )


  final String? correctionReason;



  @JsonKey(
    
    name: r'createdAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime createdAt;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is BankCaseTransitionDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            caseId,
            fromStage,
            toStage,
            performedById,
            performedByName,
            amountXof,
            rejectionReason,
            rejectionDetail,
            comment,
            correctionReason,
            createdAt,
        ],
        [
            other.id,
            other.caseId,
            other.fromStage,
            other.toStage,
            other.performedById,
            other.performedByName,
            other.amountXof,
            other.rejectionReason,
            other.rejectionDetail,
            other.comment,
            other.correctionReason,
            other.createdAt,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        caseId,
        fromStage,
        toStage,
        performedById,
        performedByName,
        amountXof,
        rejectionReason,
        rejectionDetail,
        comment,
        correctionReason,
        createdAt,
    ],);

  factory BankCaseTransitionDto.fromJson(Map<String, dynamic> json) => _$BankCaseTransitionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankCaseTransitionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

