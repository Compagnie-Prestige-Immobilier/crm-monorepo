//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'dernier_tirage_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DernierTirageDto {
  /// Returns a new [DernierTirageDto] instance.
  DernierTirageDto({
    required this.termineLe,

    required this.dureeMs,

    required this.lus,

    required this.crees,

    required this.misAJour,

    required this.rapproches,

    required this.disparues,

    required this.erreur,
  });

  @JsonKey(name: r'termineLe', required: true, includeIfNull: false)
  final DateTime termineLe;

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

  /// Inscriptions que la plateforme ne rend plus, marquées disparues par ce tirage.
  @JsonKey(name: r'disparues', required: true, includeIfNull: false)
  final num disparues;

  @JsonKey(name: r'erreur', required: true, includeIfNull: true)
  final String? erreur;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DernierTirageDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                termineLe,
                dureeMs,
                lus,
                crees,
                misAJour,
                rapproches,
                disparues,
                erreur,
              ],
              [
                other.termineLe,
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
        termineLe,
        dureeMs,
        lus,
        crees,
        misAJour,
        rapproches,
        disparues,
        erreur,
      ]);

  factory DernierTirageDto.fromJson(Map<String, dynamic> json) =>
      _$DernierTirageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DernierTirageDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
