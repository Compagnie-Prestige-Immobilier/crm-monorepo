//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/bank_rejection_reason_dto.dart';
import 'package:crm_api_client/src/model/bank_case_stage_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_case_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankCaseDto {
  /// Returns a new [BankCaseDto] instance.
  BankCaseDto({
    required this.id,

    required this.reference,

    required this.referenceKey,

    required this.prospectId,

    required this.customerName,

    required this.customerPhoneE164,

    required this.processingBankId,

    required this.processingBankName,

    required this.currentStage,

    required this.amountXof,

    required this.rejectionReason,

    required this.rejectionDetail,

    required this.rev,

    required this.isTerminal,

    required this.createdById,

    required this.createdByName,

    required this.updatedById,

    required this.updatedByName,

    required this.createdAt,

    required this.updatedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  /// Référence telle que saisie par l’agent.
  @JsonKey(name: r'reference', required: true, includeIfNull: false)
  final String reference;

  /// Forme normalisée portant l’unicité globale.
  @JsonKey(name: r'referenceKey', required: true, includeIfNull: false)
  final String referenceKey;

  @JsonKey(name: r'prospectId', required: true, includeIfNull: false)
  final String prospectId;

  /// Nom COPIÉ à la création. Immuable : corriger le prospect ne réécrit pas ce qui a été transmis à la banque.
  @JsonKey(name: r'customerName', required: true, includeIfNull: false)
  final String customerName;

  /// Téléphone E.164 copié à la création. Immuable.
  @JsonKey(name: r'customerPhoneE164', required: true, includeIfNull: false)
  final String customerPhoneE164;

  @JsonKey(name: r'processingBankId', required: true, includeIfNull: false)
  final String processingBankId;

  @JsonKey(name: r'processingBankName', required: true, includeIfNull: false)
  final String processingBankName;

  @JsonKey(name: r'currentStage', required: true, includeIfNull: false)
  final BankCaseStageDto currentStage;

  /// Montant en francs CFA, entier, exposé en chaîne. XOF n’a pas de décimales et un nombre JSON perdrait de la précision au-delà de 2^53.
  @JsonKey(name: r'amountXof', required: true, includeIfNull: true)
  final String? amountXof;

  @JsonKey(name: r'rejectionReason', required: true, includeIfNull: true)
  final BankRejectionReasonDto? rejectionReason;

  @JsonKey(name: r'rejectionDetail', required: true, includeIfNull: true)
  final String? rejectionDetail;

  /// Révision serveur. À renvoyer en `expectedRev` sur toute mutation.
  @JsonKey(name: r'rev', required: true, includeIfNull: false)
  final num rev;

  /// Dossier encaissé ou rejeté : verrouillé pour un agent BANQUE_FINANCE.
  @JsonKey(name: r'isTerminal', required: true, includeIfNull: false)
  final bool isTerminal;

  @JsonKey(name: r'createdById', required: true, includeIfNull: false)
  final String createdById;

  @JsonKey(name: r'createdByName', required: true, includeIfNull: false)
  final String createdByName;

  @JsonKey(name: r'updatedById', required: true, includeIfNull: true)
  final String? updatedById;

  @JsonKey(name: r'updatedByName', required: true, includeIfNull: true)
  final String? updatedByName;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is BankCaseDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                reference,
                referenceKey,
                prospectId,
                customerName,
                customerPhoneE164,
                processingBankId,
                processingBankName,
                currentStage,
                amountXof,
                rejectionReason,
                rejectionDetail,
                rev,
                isTerminal,
                createdById,
                createdByName,
                updatedById,
                updatedByName,
                createdAt,
                updatedAt,
              ],
              [
                other.id,
                other.reference,
                other.referenceKey,
                other.prospectId,
                other.customerName,
                other.customerPhoneE164,
                other.processingBankId,
                other.processingBankName,
                other.currentStage,
                other.amountXof,
                other.rejectionReason,
                other.rejectionDetail,
                other.rev,
                other.isTerminal,
                other.createdById,
                other.createdByName,
                other.updatedById,
                other.updatedByName,
                other.createdAt,
                other.updatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        reference,
        referenceKey,
        prospectId,
        customerName,
        customerPhoneE164,
        processingBankId,
        processingBankName,
        currentStage,
        amountXof,
        rejectionReason,
        rejectionDetail,
        rev,
        isTerminal,
        createdById,
        createdByName,
        updatedById,
        updatedByName,
        createdAt,
        updatedAt,
      ]);

  factory BankCaseDto.fromJson(Map<String, dynamic> json) =>
      _$BankCaseDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankCaseDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
