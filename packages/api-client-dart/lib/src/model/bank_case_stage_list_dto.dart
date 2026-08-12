//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/bank_case_stage_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_case_stage_list_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankCaseStageListDto {
  /// Returns a new [BankCaseStageListDto] instance.
  BankCaseStageListDto({required this.items});

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<BankCaseStageDto> items;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is BankCaseStageListDto &&
            runtimeType == other.runtimeType &&
            equals([items], [other.items]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([items]);

  factory BankCaseStageListDto.fromJson(Map<String, dynamic> json) =>
      _$BankCaseStageListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankCaseStageListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
