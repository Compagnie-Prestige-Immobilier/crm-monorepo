//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/stats_layout_widget_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_stats_layout_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateStatsLayoutDto {
  /// Returns a new [UpdateStatsLayoutDto] instance.
  UpdateStatsLayoutDto({required this.widgets});

  @JsonKey(name: r'widgets', required: true, includeIfNull: false)
  final List<StatsLayoutWidgetDto> widgets;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateStatsLayoutDto &&
            runtimeType == other.runtimeType &&
            equals([widgets], [other.widgets]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([widgets]);

  factory UpdateStatsLayoutDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateStatsLayoutDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateStatsLayoutDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
