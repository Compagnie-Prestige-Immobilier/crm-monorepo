//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_stat_saisie_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteStatSaisieDto {
  /// Returns a new [VisiteStatSaisieDto] instance.
  VisiteStatSaisieDto({
    required this.memeJour,

    required this.lendemain,

    required this.plusTard,

    required this.delaiMedianHeures,
  });

  /// Saisies faites le jour même de la visite.
  @JsonKey(name: r'memeJour', required: true, includeIfNull: false)
  final num memeJour;

  /// Saisies faites le lendemain de la visite.
  @JsonKey(name: r'lendemain', required: true, includeIfNull: false)
  final num lendemain;

  /// Saisies faites deux jours après la visite ou plus.
  @JsonKey(name: r'plusTard', required: true, includeIfNull: false)
  final num plusTard;

  @JsonKey(name: r'delaiMedianHeures', required: true, includeIfNull: true)
  final num? delaiMedianHeures;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is VisiteStatSaisieDto &&
            runtimeType == other.runtimeType &&
            equals(
              [memeJour, lendemain, plusTard, delaiMedianHeures],
              [
                other.memeJour,
                other.lendemain,
                other.plusTard,
                other.delaiMedianHeures,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([memeJour, lendemain, plusTard, delaiMedianHeures]);

  factory VisiteStatSaisieDto.fromJson(Map<String, dynamic> json) =>
      _$VisiteStatSaisieDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteStatSaisieDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
