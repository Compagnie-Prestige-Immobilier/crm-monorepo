//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_rejection_reason_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankRejectionReasonDto {
  /// Returns a new [BankRejectionReasonDto] instance.
  BankRejectionReasonDto({
    required this.id,

    required this.code,

    required this.label,

    required this.sortOrder,

    required this.isActive,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'sortOrder', required: true, includeIfNull: false)
  final num sortOrder;

  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is BankRejectionReasonDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, code, label, sortOrder, isActive],
              [
                other.id,
                other.code,
                other.label,
                other.sortOrder,
                other.isActive,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([id, code, label, sortOrder, isActive]);

  factory BankRejectionReasonDto.fromJson(Map<String, dynamic> json) =>
      _$BankRejectionReasonDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankRejectionReasonDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
