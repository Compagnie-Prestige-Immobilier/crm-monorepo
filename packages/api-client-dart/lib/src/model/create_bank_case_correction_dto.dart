//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_bank_case_correction_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateBankCaseCorrectionDto {
  /// Returns a new [CreateBankCaseCorrectionDto] instance.
  CreateBankCaseCorrectionDto({

    required  this.targetStageId,

    required  this.expectedRev,

     this.amountXof,

     this.rejectionReasonId,

     this.rejectionDetail,

     this.comment,

    required  this.reason,
  });

  @JsonKey(
    
    name: r'targetStageId',
    required: true,
    includeIfNull: false,
  )


  final String targetStageId;



          // minimum: 1
  @JsonKey(
    
    name: r'expectedRev',
    required: true,
    includeIfNull: false,
  )


  final num expectedRev;



      /// Montant en francs CFA, entier, exposé en chaîne. XOF n’a pas de décimales et un nombre JSON perdrait de la précision au-delà de 2^53. Obligatoire et strictement positif vers l’étape d’encaissement, interdit ailleurs. Ignoré vers l’étape de rejet, où le serveur force 0.
  @JsonKey(
    
    name: r'amountXof',
    required: false,
    includeIfNull: false,
  )


  final String? amountXof;



      /// Obligatoire vers l’étape de rejet.
  @JsonKey(
    
    name: r'rejectionReasonId',
    required: false,
    includeIfNull: false,
  )


  final String? rejectionReasonId;



      /// Obligatoire quand le motif de rejet est « AUTRE ».
  @JsonKey(
    
    name: r'rejectionDetail',
    required: false,
    includeIfNull: false,
  )


  final String? rejectionDetail;



  @JsonKey(
    
    name: r'comment',
    required: false,
    includeIfNull: false,
  )


  final String? comment;



      /// Justification obligatoire. Elle est enregistrée sur la transition et distingue une correction d’une avancée normale.
  @JsonKey(
    
    name: r'reason',
    required: true,
    includeIfNull: false,
  )


  final String reason;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is CreateBankCaseCorrectionDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            targetStageId,
            expectedRev,
            amountXof,
            rejectionReasonId,
            rejectionDetail,
            comment,
            reason,
        ],
        [
            other.targetStageId,
            other.expectedRev,
            other.amountXof,
            other.rejectionReasonId,
            other.rejectionDetail,
            other.comment,
            other.reason,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        targetStageId,
        expectedRev,
        amountXof,
        rejectionReasonId,
        rejectionDetail,
        comment,
        reason,
    ],);

  factory CreateBankCaseCorrectionDto.fromJson(Map<String, dynamic> json) => _$CreateBankCaseCorrectionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateBankCaseCorrectionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

