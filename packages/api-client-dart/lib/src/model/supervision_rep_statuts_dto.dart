//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/supervision_rep_statut_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'supervision_rep_statuts_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SupervisionRepStatutsDto {
  /// Returns a new [SupervisionRepStatutsDto] instance.
  SupervisionRepStatutsDto({required this.total, required this.items});

  /// Représentants distincts comptés dans la répartition.
  @JsonKey(name: r'total', required: true, includeIfNull: false)
  final num total;

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<SupervisionRepStatutDto> items;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SupervisionRepStatutsDto &&
            runtimeType == other.runtimeType &&
            equals([total, items], [other.total, other.items]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([total, items]);

  factory SupervisionRepStatutsDto.fromJson(Map<String, dynamic> json) =>
      _$SupervisionRepStatutsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisionRepStatutsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
