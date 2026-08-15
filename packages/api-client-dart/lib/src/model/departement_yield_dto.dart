//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'departement_yield_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DepartementYieldDto {
  /// Returns a new [DepartementYieldDto] instance.
  DepartementYieldDto({
    required this.id,

    required this.label,

    required this.prospects,

    required this.methodObtained,

    required this.cases,

    required this.cashed,

    required this.cashedAmountXof,

    required this.methodRate,

    required this.conversionRate,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'prospects', required: true, includeIfNull: false)
  final num prospects;

  @JsonKey(name: r'methodObtained', required: true, includeIfNull: false)
  final num methodObtained;

  @JsonKey(name: r'cases', required: true, includeIfNull: false)
  final num cases;

  @JsonKey(name: r'cashed', required: true, includeIfNull: false)
  final num cashed;

  /// Montant encaissé, en francs CFA. Chaîne.
  @JsonKey(name: r'cashedAmountXof', required: true, includeIfNull: false)
  final String cashedAmountXof;

  /// Méthodes obtenues rapportées aux prospects, en %. Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.
  @JsonKey(name: r'methodRate', required: true, includeIfNull: true)
  final num? methodRate;

  /// Encaissements rapportés aux prospects, en pourcentage. Le rendement réel. Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.
  @JsonKey(name: r'conversionRate', required: true, includeIfNull: true)
  final num? conversionRate;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DepartementYieldDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                label,
                prospects,
                methodObtained,
                cases,
                cashed,
                cashedAmountXof,
                methodRate,
                conversionRate,
              ],
              [
                other.id,
                other.label,
                other.prospects,
                other.methodObtained,
                other.cases,
                other.cashed,
                other.cashedAmountXof,
                other.methodRate,
                other.conversionRate,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        label,
        prospects,
        methodObtained,
        cases,
        cashed,
        cashedAmountXof,
        methodRate,
        conversionRate,
      ]);

  factory DepartementYieldDto.fromJson(Map<String, dynamic> json) =>
      _$DepartementYieldDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DepartementYieldDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
