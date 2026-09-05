//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_bank_case_transition_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateBankCaseTransitionDto {
  /// Returns a new [CreateBankCaseTransitionDto] instance.
  CreateBankCaseTransitionDto({
    required this.targetStageId,

    required this.expectedRev,

    this.amountXof,

    this.rejectionReasonId,

    this.rejectionDetail,

    this.comment,
  });

  @JsonKey(name: r'targetStageId', required: true, includeIfNull: false)
  final String targetStageId;

  // minimum: 1
  @JsonKey(name: r'expectedRev', required: true, includeIfNull: false)
  final num expectedRev;

  /// Montant en francs CFA, entier, exposé en chaîne. XOF n’a pas de décimales et un nombre JSON perdrait de la précision au-delà de 2^53. Obligatoire et strictement positif vers l’étape d’encaissement, interdit ailleurs. Ignoré vers l’étape de rejet, où le serveur force 0.
  @JsonKey(name: r'amountXof', required: false, includeIfNull: false)
  final String? amountXof;

  /// Obligatoire vers l’étape de rejet.
  @JsonKey(name: r'rejectionReasonId', required: false, includeIfNull: false)
  final String? rejectionReasonId;

  /// Obligatoire quand le motif de rejet est « AUTRE ».
  @JsonKey(name: r'rejectionDetail', required: false, includeIfNull: false)
  final String? rejectionDetail;

  @JsonKey(name: r'comment', required: false, includeIfNull: false)
  final String? comment;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateBankCaseTransitionDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                targetStageId,
                expectedRev,
                amountXof,
                rejectionReasonId,
                rejectionDetail,
                comment,
              ],
              [
                other.targetStageId,
                other.expectedRev,
                other.amountXof,
                other.rejectionReasonId,
                other.rejectionDetail,
                other.comment,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        targetStageId,
        expectedRev,
        amountXof,
        rejectionReasonId,
        rejectionDetail,
        comment,
      ]);

  factory CreateBankCaseTransitionDto.fromJson(Map<String, dynamic> json) =>
      _$CreateBankCaseTransitionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateBankCaseTransitionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
