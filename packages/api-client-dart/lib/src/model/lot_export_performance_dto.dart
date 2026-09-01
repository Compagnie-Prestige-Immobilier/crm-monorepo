//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'lot_export_performance_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LotExportPerformanceDto {
  /// Returns a new [LotExportPerformanceDto] instance.
  LotExportPerformanceDto({
    required this.teleconseillerId,

    required this.teleconseillerName,

    required this.assigned,

    required this.treated,

    required this.completionRate,

    required this.assignedCalls,

    required this.outsideAssignmentCalls,
  });

  @JsonKey(name: r'teleconseillerId', required: true, includeIfNull: false)
  final String teleconseillerId;

  @JsonKey(name: r'teleconseillerName', required: true, includeIfNull: false)
  final String teleconseillerName;

  @JsonKey(name: r'assigned', required: true, includeIfNull: false)
  final num assigned;

  @JsonKey(name: r'treated', required: true, includeIfNull: false)
  final num treated;

  @JsonKey(name: r'completionRate', required: true, includeIfNull: false)
  final num completionRate;

  @JsonKey(name: r'assignedCalls', required: true, includeIfNull: false)
  final num assignedCalls;

  @JsonKey(
    name: r'outsideAssignmentCalls',
    required: true,
    includeIfNull: false,
  )
  final num outsideAssignmentCalls;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is LotExportPerformanceDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                teleconseillerId,
                teleconseillerName,
                assigned,
                treated,
                completionRate,
                assignedCalls,
                outsideAssignmentCalls,
              ],
              [
                other.teleconseillerId,
                other.teleconseillerName,
                other.assigned,
                other.treated,
                other.completionRate,
                other.assignedCalls,
                other.outsideAssignmentCalls,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        teleconseillerId,
        teleconseillerName,
        assigned,
        treated,
        completionRate,
        assignedCalls,
        outsideAssignmentCalls,
      ]);

  factory LotExportPerformanceDto.fromJson(Map<String, dynamic> json) =>
      _$LotExportPerformanceDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LotExportPerformanceDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
