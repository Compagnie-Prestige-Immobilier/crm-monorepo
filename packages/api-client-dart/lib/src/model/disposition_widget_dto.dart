//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/dashboard_source.dart';
import 'package:crm_api_client/src/model/dashboard_taille.dart';
import 'package:crm_api_client/src/model/dashboard_marque.dart';
import 'package:crm_api_client/src/model/disposition_presentation_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'disposition_widget_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DispositionWidgetDto {
  /// Returns a new [DispositionWidgetDto] instance.
  DispositionWidgetDto({
    required this.source_,

    this.marque,

    this.taille,

    this.presentation,
  });

  @JsonKey(
    name: r'source',
    required: true,
    includeIfNull: false,
    unknownEnumValue: DashboardSource.unknownDefaultOpenApi,
  )
  final DashboardSource source_;

  @JsonKey(
    name: r'marque',
    required: false,
    includeIfNull: false,
    unknownEnumValue: DashboardMarque.unknownDefaultOpenApi,
  )
  final DashboardMarque? marque;

  @JsonKey(
    name: r'taille',
    required: false,
    includeIfNull: false,
    unknownEnumValue: DashboardTaille.unknownDefaultOpenApi,
  )
  final DashboardTaille? taille;

  @JsonKey(name: r'presentation', required: false, includeIfNull: false)
  final DispositionPresentationDto? presentation;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DispositionWidgetDto &&
            runtimeType == other.runtimeType &&
            equals(
              [source_, marque, taille, presentation],
              [other.source_, other.marque, other.taille, other.presentation],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([source_, marque, taille, presentation]);

  factory DispositionWidgetDto.fromJson(Map<String, dynamic> json) =>
      _$DispositionWidgetDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DispositionWidgetDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
