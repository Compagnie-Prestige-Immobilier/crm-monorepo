//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/representant_fiche_change_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_fiche_change_list_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantFicheChangeListDto {
  /// Returns a new [RepresentantFicheChangeListDto] instance.
  RepresentantFicheChangeListDto({required this.items});

  /// De la plus récente à la plus ancienne.
  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<RepresentantFicheChangeDto> items;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepresentantFicheChangeListDto &&
            runtimeType == other.runtimeType &&
            equals([items], [other.items]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([items]);

  factory RepresentantFicheChangeListDto.fromJson(Map<String, dynamic> json) =>
      _$RepresentantFicheChangeListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantFicheChangeListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
