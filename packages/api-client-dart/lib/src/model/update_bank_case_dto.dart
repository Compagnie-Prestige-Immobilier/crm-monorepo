//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_bank_case_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateBankCaseDto {
  /// Returns a new [UpdateBankCaseDto] instance.
  UpdateBankCaseDto({
    required this.expectedRev,

    this.reference,

    this.processingBankId,
  });

  /// Révision attendue. Un écart renvoie BANK_CASE_REV_CONFLICT avec l’état courant.
  // minimum: 1
  @JsonKey(name: r'expectedRev', required: true, includeIfNull: false)
  final num expectedRev;

  @JsonKey(name: r'reference', required: false, includeIfNull: false)
  final String? reference;

  @JsonKey(name: r'processingBankId', required: false, includeIfNull: false)
  final String? processingBankId;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateBankCaseDto &&
            runtimeType == other.runtimeType &&
            equals(
              [expectedRev, reference, processingBankId],
              [other.expectedRev, other.reference, other.processingBankId],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([expectedRev, reference, processingBankId]);

  factory UpdateBankCaseDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateBankCaseDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateBankCaseDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
