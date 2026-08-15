//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'rep_campaign_preview_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepCampaignPreviewDto {
  /// Returns a new [RepCampaignPreviewDto] instance.
  RepCampaignPreviewDto({
    required this.eligible,

    required this.perCommercial,

    required this.perDay,

    required this.scopeLabel,
  });

  /// Représentants éligibles sur ce périmètre.
  @JsonKey(name: r'eligible', required: true, includeIfNull: false)
  final num eligible;

  /// Lignes par commercial, au plus.
  @JsonKey(name: r'perCommercial', required: true, includeIfNull: false)
  final num perCommercial;

  /// Lignes par journée POUR UN commercial, jour 1 en tête. C’est le chiffre qui dit si la journée est tenable.
  @JsonKey(name: r'perDay', required: true, includeIfNull: false)
  final List<num> perDay;

  /// Libellé lisible du périmètre.
  @JsonKey(name: r'scopeLabel', required: true, includeIfNull: false)
  final String scopeLabel;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepCampaignPreviewDto &&
            runtimeType == other.runtimeType &&
            equals(
              [eligible, perCommercial, perDay, scopeLabel],
              [
                other.eligible,
                other.perCommercial,
                other.perDay,
                other.scopeLabel,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([eligible, perCommercial, perDay, scopeLabel]);

  factory RepCampaignPreviewDto.fromJson(Map<String, dynamic> json) =>
      _$RepCampaignPreviewDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepCampaignPreviewDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
