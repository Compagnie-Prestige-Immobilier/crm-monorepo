//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'analytics_finance_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AnalyticsFinanceDto {
  /// Returns a new [AnalyticsFinanceDto] instance.
  AnalyticsFinanceDto({
    required this.montantEncaisse,

    required this.montantEnCours,

    required this.encaissementMoyen,

    required this.montantEncaisse30Jours,

    required this.dossiers,

    required this.dossiersOuverts,

    required this.dossiersEncaisses,

    required this.dossiersRejetes,

    required this.tauxRejet,

    required this.delaiMoyenJours,
  });

  /// Total encaissé, en francs CFA. Chaîne : XOF est un Decimal(18,0).
  @JsonKey(name: r'montantEncaisse', required: true, includeIfNull: false)
  final String montantEncaisse;

  /// Montant des dossiers encore ouverts, à l’instant. Chaîne.
  @JsonKey(name: r'montantEnCours', required: true, includeIfNull: false)
  final String montantEnCours;

  /// Encaissement moyen par dossier encaissé. Chaîne.
  @JsonKey(name: r'encaissementMoyen', required: true, includeIfNull: false)
  final String encaissementMoyen;

  /// Total encaissé sur les 30 derniers jours. Chaîne.
  @JsonKey(
    name: r'montantEncaisse30Jours',
    required: true,
    includeIfNull: false,
  )
  final String montantEncaisse30Jours;

  @JsonKey(name: r'dossiers', required: true, includeIfNull: false)
  final num dossiers;

  /// Dossiers encore ouverts.
  @JsonKey(name: r'dossiersOuverts', required: true, includeIfNull: false)
  final num dossiersOuverts;

  @JsonKey(name: r'dossiersEncaisses', required: true, includeIfNull: false)
  final num dossiersEncaisses;

  @JsonKey(name: r'dossiersRejetes', required: true, includeIfNull: false)
  final num dossiersRejetes;

  /// Part des dossiers clos qui ont été rejetés, en pourcentage. Calculée sur les dossiers CLOS et non sur tous : inclure les dossiers en cours ferait baisser le taux simplement parce qu’on ouvre des dossiers.
  @JsonKey(name: r'tauxRejet', required: true, includeIfNull: false)
  final num tauxRejet;

  /// Délai moyen en jours entre l’ouverture d’un dossier et son issue. Nul tant qu’aucun dossier n’est clos.
  @JsonKey(name: r'delaiMoyenJours', required: true, includeIfNull: true)
  final num? delaiMoyenJours;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is AnalyticsFinanceDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                montantEncaisse,
                montantEnCours,
                encaissementMoyen,
                montantEncaisse30Jours,
                dossiers,
                dossiersOuverts,
                dossiersEncaisses,
                dossiersRejetes,
                tauxRejet,
                delaiMoyenJours,
              ],
              [
                other.montantEncaisse,
                other.montantEnCours,
                other.encaissementMoyen,
                other.montantEncaisse30Jours,
                other.dossiers,
                other.dossiersOuverts,
                other.dossiersEncaisses,
                other.dossiersRejetes,
                other.tauxRejet,
                other.delaiMoyenJours,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        montantEncaisse,
        montantEnCours,
        encaissementMoyen,
        montantEncaisse30Jours,
        dossiers,
        dossiersOuverts,
        dossiersEncaisses,
        dossiersRejetes,
        tauxRejet,
        delaiMoyenJours,
      ]);

  factory AnalyticsFinanceDto.fromJson(Map<String, dynamic> json) =>
      _$AnalyticsFinanceDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AnalyticsFinanceDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
