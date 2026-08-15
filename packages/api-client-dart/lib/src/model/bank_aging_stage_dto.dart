//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/bank_aging_bucket_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_aging_stage_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankAgingStageDto {
  /// Returns a new [BankAgingStageDto] instance.
  BankAgingStageDto({
    required this.stageId,

    required this.label,

    required this.dossiers,

    required this.share,

    required this.medianStationDays,

    required this.buckets,
  });

  @JsonKey(name: r'stageId', required: true, includeIfNull: false)
  final String stageId;

  /// Libellé de l’étape, issu du référentiel.
  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'dossiers', required: true, includeIfNull: false)
  final num dossiers;

  /// Part du total, en pourcentage. Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.
  @JsonKey(name: r'share', required: true, includeIfNull: true)
  final num? share;

  /// Durée médiane de stationnement à cette étape, en jours. Comptée depuis la dernière transition VERS l’étape, ou depuis l’ouverture du dossier quand il n’a jamais bougé. Nulle quand l’étape est vide.
  @JsonKey(name: r'medianStationDays', required: true, includeIfNull: true)
  final num? medianStationDays;

  /// Ancienneté des dossiers de cette étape, les cinq tranches toujours présentes.
  @JsonKey(name: r'buckets', required: true, includeIfNull: false)
  final List<BankAgingBucketDto> buckets;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is BankAgingStageDto &&
            runtimeType == other.runtimeType &&
            equals(
              [stageId, label, dossiers, share, medianStationDays, buckets],
              [
                other.stageId,
                other.label,
                other.dossiers,
                other.share,
                other.medianStationDays,
                other.buckets,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        stageId,
        label,
        dossiers,
        share,
        medianStationDays,
        buckets,
      ]);

  factory BankAgingStageDto.fromJson(Map<String, dynamic> json) =>
      _$BankAgingStageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankAgingStageDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
