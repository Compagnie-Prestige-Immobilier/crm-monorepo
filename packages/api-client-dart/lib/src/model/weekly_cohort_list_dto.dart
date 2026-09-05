//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/weekly_cohort_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'weekly_cohort_list_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class WeeklyCohortListDto {
  /// Returns a new [WeeklyCohortListDto] instance.
  WeeklyCohortListDto({required this.items, required this.total});

  /// Semaines, de la plus ancienne.
  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<WeeklyCohortDto> items;

  /// Prospects toutes cohortes confondues.
  @JsonKey(name: r'total', required: true, includeIfNull: false)
  final num total;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is WeeklyCohortListDto &&
            runtimeType == other.runtimeType &&
            equals([items, total], [other.items, other.total]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([items, total]);

  factory WeeklyCohortListDto.fromJson(Map<String, dynamic> json) =>
      _$WeeklyCohortListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$WeeklyCohortListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
