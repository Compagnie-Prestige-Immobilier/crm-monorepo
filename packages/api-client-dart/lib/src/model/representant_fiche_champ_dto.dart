//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_fiche_champ_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantFicheChampDto {
  /// Returns a new [RepresentantFicheChampDto] instance.
  RepresentantFicheChampDto({
    required this.champ,

    required this.avant,

    required this.apres,
  });

  /// Le nom du champ du formulaire, tel que la base le porte.
  @JsonKey(name: r'champ', required: true, includeIfNull: false)
  final String champ;

  /// Booléen rendu « true »/« false ».
  @JsonKey(name: r'avant', required: true, includeIfNull: true)
  final String? avant;

  @JsonKey(name: r'apres', required: true, includeIfNull: true)
  final String? apres;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepresentantFicheChampDto &&
            runtimeType == other.runtimeType &&
            equals(
              [champ, avant, apres],
              [other.champ, other.avant, other.apres],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([champ, avant, apres]);

  factory RepresentantFicheChampDto.fromJson(Map<String, dynamic> json) =>
      _$RepresentantFicheChampDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantFicheChampDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
