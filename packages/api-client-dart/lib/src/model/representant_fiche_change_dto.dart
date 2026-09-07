//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/representant_fiche_champ_dto.dart';
import 'package:crm_api_client/src/model/fiche_change_source.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_fiche_change_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantFicheChangeDto {
  /// Returns a new [RepresentantFicheChangeDto] instance.
  RepresentantFicheChangeDto({
    required this.id,

    required this.representantId,

    required this.source_,

    required this.changedById,

    required this.changedByName,

    required this.changedAt,

    required this.champs,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'representantId', required: true, includeIfNull: false)
  final String representantId;

  @JsonKey(
    name: r'source',
    required: true,
    includeIfNull: false,
    unknownEnumValue: FicheChangeSource.unknownDefaultOpenApi,
  )
  final FicheChangeSource source_;

  @JsonKey(name: r'changedById', required: true, includeIfNull: true)
  final String? changedById;

  @JsonKey(name: r'changedByName', required: true, includeIfNull: false)
  final String changedByName;

  @JsonKey(name: r'changedAt', required: true, includeIfNull: false)
  final DateTime changedAt;

  @JsonKey(name: r'champs', required: true, includeIfNull: false)
  final List<RepresentantFicheChampDto> champs;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepresentantFicheChangeDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                representantId,
                source_,
                changedById,
                changedByName,
                changedAt,
                champs,
              ],
              [
                other.id,
                other.representantId,
                other.source_,
                other.changedById,
                other.changedByName,
                other.changedAt,
                other.champs,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        representantId,
        source_,
        changedById,
        changedByName,
        changedAt,
        champs,
      ]);

  factory RepresentantFicheChangeDto.fromJson(Map<String, dynamic> json) =>
      _$RepresentantFicheChangeDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantFicheChangeDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
