//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'campaign_progress_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CampaignProgressDto {
  /// Returns a new [CampaignProgressDto] instance.
  CampaignProgressDto({
    required this.total,

    required this.open,

    required this.done,

    required this.cancelled,
  });

  /// Nombre total de tâches affectées.
  @JsonKey(name: r'total', required: true, includeIfNull: false)
  final num total;

  /// Tâches encore ouvertes.
  @JsonKey(name: r'open', required: true, includeIfNull: false)
  final num open;

  /// Tâches abouties : une issue terminale a été saisie.
  @JsonKey(name: r'done', required: true, includeIfNull: false)
  final num done;

  /// Tâches annulées par la clôture de la campagne.
  @JsonKey(name: r'cancelled', required: true, includeIfNull: false)
  final num cancelled;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CampaignProgressDto &&
            runtimeType == other.runtimeType &&
            equals(
              [total, open, done, cancelled],
              [other.total, other.open, other.done, other.cancelled],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([total, open, done, cancelled]);

  factory CampaignProgressDto.fromJson(Map<String, dynamic> json) =>
      _$CampaignProgressDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CampaignProgressDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
