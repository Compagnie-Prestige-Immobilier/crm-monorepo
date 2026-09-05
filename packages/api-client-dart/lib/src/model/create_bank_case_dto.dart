//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_bank_case_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateBankCaseDto {
  /// Returns a new [CreateBankCaseDto] instance.
  CreateBankCaseDto({
    required this.prospectId,

    required this.reference,

    this.processingBankId,
  });

  /// Prospect actif dont `phase2Status` vaut METHOD_OBTAINED. Toute autre valeur est refusée.
  @JsonKey(name: r'prospectId', required: true, includeIfNull: false)
  final String prospectId;

  /// Référence bancaire. Unicité globale sur sa forme normalisée.
  @JsonKey(name: r'reference', required: true, includeIfNull: false)
  final String reference;

  /// Défaut : la banque du prospect. L’agent peut en choisir une autre.
  @JsonKey(name: r'processingBankId', required: false, includeIfNull: false)
  final String? processingBankId;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateBankCaseDto &&
            runtimeType == other.runtimeType &&
            equals(
              [prospectId, reference, processingBankId],
              [other.prospectId, other.reference, other.processingBankId],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([prospectId, reference, processingBankId]);

  factory CreateBankCaseDto.fromJson(Map<String, dynamic> json) =>
      _$CreateBankCaseDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateBankCaseDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
