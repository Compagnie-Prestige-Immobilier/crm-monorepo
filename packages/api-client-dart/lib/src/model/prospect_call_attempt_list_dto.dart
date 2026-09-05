//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/prospect_call_attempt_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'prospect_call_attempt_list_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProspectCallAttemptListDto {
  /// Returns a new [ProspectCallAttemptListDto] instance.
  ProspectCallAttemptListDto({required this.items});

  /// Du plus récent au plus ancien.
  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<ProspectCallAttemptDto> items;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ProspectCallAttemptListDto &&
            runtimeType == other.runtimeType &&
            equals([items], [other.items]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([items]);

  factory ProspectCallAttemptListDto.fromJson(Map<String, dynamic> json) =>
      _$ProspectCallAttemptListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ProspectCallAttemptListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
