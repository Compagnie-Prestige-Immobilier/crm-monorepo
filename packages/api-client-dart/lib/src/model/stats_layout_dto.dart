//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/stats_layout_widget_dto.dart';
import 'package:crm_api_client/src/model/stats_layout_screen.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'stats_layout_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StatsLayoutDto {
  /// Returns a new [StatsLayoutDto] instance.
  StatsLayoutDto({
    required this.screen,

    required this.widgets,

    required this.updatedAt,
  });

  @JsonKey(
    name: r'screen',
    required: true,
    includeIfNull: false,
    unknownEnumValue: StatsLayoutScreen.unknownDefaultOpenApi,
  )
  final StatsLayoutScreen screen;

  @JsonKey(name: r'widgets', required: true, includeIfNull: false)
  final List<StatsLayoutWidgetDto> widgets;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: true)
  final DateTime? updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is StatsLayoutDto &&
            runtimeType == other.runtimeType &&
            equals(
              [screen, widgets, updatedAt],
              [other.screen, other.widgets, other.updatedAt],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([screen, widgets, updatedAt]);

  factory StatsLayoutDto.fromJson(Map<String, dynamic> json) =>
      _$StatsLayoutDtoFromJson(json);

  Map<String, dynamic> toJson() => _$StatsLayoutDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
