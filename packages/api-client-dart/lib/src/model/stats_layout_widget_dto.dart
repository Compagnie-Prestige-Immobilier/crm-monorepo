//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'stats_layout_widget_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StatsLayoutWidgetDto {
  /// Returns a new [StatsLayoutWidgetDto] instance.
  StatsLayoutWidgetDto({required this.id, required this.visible});

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'visible', required: true, includeIfNull: false)
  final bool visible;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is StatsLayoutWidgetDto &&
            runtimeType == other.runtimeType &&
            equals([id, visible], [other.id, other.visible]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([id, visible]);

  factory StatsLayoutWidgetDto.fromJson(Map<String, dynamic> json) =>
      _$StatsLayoutWidgetDtoFromJson(json);

  Map<String, dynamic> toJson() => _$StatsLayoutWidgetDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
