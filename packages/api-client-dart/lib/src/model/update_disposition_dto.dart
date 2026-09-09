//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/dashboard_preset.dart';
import 'package:crm_api_client/src/model/disposition_widget_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_disposition_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateDispositionDto {
  /// Returns a new [UpdateDispositionDto] instance.
  UpdateDispositionDto({this.preset, required this.widgets});

  @JsonKey(
    name: r'preset',
    required: false,
    includeIfNull: false,
    unknownEnumValue: DashboardPreset.unknownDefaultOpenApi,
  )
  final DashboardPreset? preset;

  /// Les éléments du tableau de bord. `version` est fixé par le serveur et refusé s’il est transmis.
  @JsonKey(name: r'widgets', required: true, includeIfNull: false)
  final List<DispositionWidgetDto> widgets;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateDispositionDto &&
            runtimeType == other.runtimeType &&
            equals([preset, widgets], [other.preset, other.widgets]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([preset, widgets]);

  factory UpdateDispositionDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateDispositionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateDispositionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
