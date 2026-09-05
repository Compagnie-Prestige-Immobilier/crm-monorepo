//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_rejection_breakdown_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankRejectionBreakdownDto {
  /// Returns a new [BankRejectionBreakdownDto] instance.
  BankRejectionBreakdownDto({
    required this.reasonId,

    required this.code,

    required this.label,

    required this.cases,

    required this.share,
  });

  @JsonKey(name: r'reasonId', required: true, includeIfNull: false)
  final String reasonId;

  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'cases', required: true, includeIfNull: false)
  final num cases;

  @JsonKey(name: r'share', required: true, includeIfNull: false)
  final num share;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is BankRejectionBreakdownDto &&
            runtimeType == other.runtimeType &&
            equals(
              [reasonId, code, label, cases, share],
              [
                other.reasonId,
                other.code,
                other.label,
                other.cases,
                other.share,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([reasonId, code, label, cases, share]);

  factory BankRejectionBreakdownDto.fromJson(Map<String, dynamic> json) =>
      _$BankRejectionBreakdownDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankRejectionBreakdownDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
