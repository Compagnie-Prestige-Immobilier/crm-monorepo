//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/supervision_campagnes_totaux_dto.dart';
import 'package:crm_api_client/src/model/supervision_campagne_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'supervision_campagnes_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SupervisionCampagnesDto {
  /// Returns a new [SupervisionCampagnesDto] instance.
  SupervisionCampagnesDto({required this.items, required this.totals});

  /// Les campagnes dont un jour de programme tombe dans la fenêtre, la plus récente en tête.
  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<SupervisionCampagneDto> items;

  @JsonKey(name: r'totals', required: true, includeIfNull: false)
  final SupervisionCampagnesTotauxDto totals;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SupervisionCampagnesDto &&
            runtimeType == other.runtimeType &&
            equals([items, totals], [other.items, other.totals]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([items, totals]);

  factory SupervisionCampagnesDto.fromJson(Map<String, dynamic> json) =>
      _$SupervisionCampagnesDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisionCampagnesDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
