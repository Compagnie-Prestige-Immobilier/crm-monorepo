//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/call_outcome_reason_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'call_outcome_reason_list_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CallOutcomeReasonListDto {
  /// Returns a new [CallOutcomeReasonListDto] instance.
  CallOutcomeReasonListDto({required this.items});

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<CallOutcomeReasonDto> items;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CallOutcomeReasonListDto &&
            runtimeType == other.runtimeType &&
            equals([items], [other.items]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([items]);

  factory CallOutcomeReasonListDto.fromJson(Map<String, dynamic> json) =>
      _$CallOutcomeReasonListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CallOutcomeReasonListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
