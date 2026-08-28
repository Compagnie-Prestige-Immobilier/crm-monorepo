//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/dashboard_preset.dart';
import 'package:crm_api_client/src/model/disposition_widget_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'disposition_response_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DispositionResponseDto {
  /// Returns a new [DispositionResponseDto] instance.
  DispositionResponseDto({
    required this.widgets,

    required this.preset,

    required this.source_,

    required this.updatedAt,
  });

  @JsonKey(name: r'widgets', required: true, includeIfNull: false)
  final List<DispositionWidgetDto> widgets;

  @JsonKey(
    name: r'preset',
    required: true,
    includeIfNull: false,
    unknownEnumValue: DashboardPreset.unknownDefaultOpenApi,
  )
  final DashboardPreset preset;

  /// D’où vient la disposition rendue : la sienne, celle fixée par l’administrateur, ou celle d’usine.
  @JsonKey(
    name: r'source',
    required: true,
    includeIfNull: false,
    unknownEnumValue: DispositionResponseDtoSource_Enum.unknownDefaultOpenApi,
  )
  final DispositionResponseDtoSource_Enum source_;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: true)
  final DateTime? updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DispositionResponseDto &&
            runtimeType == other.runtimeType &&
            equals(
              [widgets, preset, source_, updatedAt],
              [other.widgets, other.preset, other.source_, other.updatedAt],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([widgets, preset, source_, updatedAt]);

  factory DispositionResponseDto.fromJson(Map<String, dynamic> json) =>
      _$DispositionResponseDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DispositionResponseDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

/// D’où vient la disposition rendue : la sienne, celle fixée par l’administrateur, ou celle d’usine.
enum DispositionResponseDtoSource_Enum {
  /// D’où vient la disposition rendue : la sienne, celle fixée par l’administrateur, ou celle d’usine.
  @JsonValue(r'utilisateur')
  utilisateur(r'utilisateur'),

  /// D’où vient la disposition rendue : la sienne, celle fixée par l’administrateur, ou celle d’usine.
  @JsonValue(r'defaut')
  defaut(r'defaut'),

  /// D’où vient la disposition rendue : la sienne, celle fixée par l’administrateur, ou celle d’usine.
  @JsonValue(r'usine')
  usine(r'usine'),

  /// D’où vient la disposition rendue : la sienne, celle fixée par l’administrateur, ou celle d’usine.
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const DispositionResponseDtoSource_Enum(this.value);

  final String value;

  @override
  String toString() => value;
}
