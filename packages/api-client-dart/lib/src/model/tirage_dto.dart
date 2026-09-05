//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/projet.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'tirage_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TirageDto {
  /// Returns a new [TirageDto] instance.
  TirageDto({
    required this.projet,

    required this.dureeMs,

    required this.lus,

    required this.crees,

    required this.misAJour,

    required this.rapproches,

    required this.disparues,

    required this.erreur,
  });

  @JsonKey(
    name: r'projet',
    required: true,
    includeIfNull: false,
    unknownEnumValue: Projet.unknownDefaultOpenApi,
  )
  final Projet projet;

  @JsonKey(name: r'dureeMs', required: true, includeIfNull: false)
  final num dureeMs;

  @JsonKey(name: r'lus', required: true, includeIfNull: false)
  final num lus;

  @JsonKey(name: r'crees', required: true, includeIfNull: false)
  final num crees;

  @JsonKey(name: r'misAJour', required: true, includeIfNull: false)
  final num misAJour;

  @JsonKey(name: r'rapproches', required: true, includeIfNull: false)
  final num rapproches;

  @JsonKey(name: r'disparues', required: true, includeIfNull: false)
  final num disparues;

  @JsonKey(name: r'erreur', required: true, includeIfNull: true)
  final String? erreur;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is TirageDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                projet,
                dureeMs,
                lus,
                crees,
                misAJour,
                rapproches,
                disparues,
                erreur,
              ],
              [
                other.projet,
                other.dureeMs,
                other.lus,
                other.crees,
                other.misAJour,
                other.rapproches,
                other.disparues,
                other.erreur,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        projet,
        dureeMs,
        lus,
        crees,
        misAJour,
        rapproches,
        disparues,
        erreur,
      ]);

  factory TirageDto.fromJson(Map<String, dynamic> json) =>
      _$TirageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$TirageDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
