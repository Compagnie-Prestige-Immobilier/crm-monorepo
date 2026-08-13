//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'audience_preview_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AudiencePreviewDto {
  /// Returns a new [AudiencePreviewDto] instance.
  AudiencePreviewDto({
    required this.recipientCount,

    required this.reachableCount,

    required this.transportConfigured,

    required this.transportReason,
  });

  /// Comptes actifs visés.
  @JsonKey(name: r'recipientCount', required: true, includeIfNull: false)
  final num recipientCount;

  /// Destinataires possédant au moins un appareil enregistré. L’écart avec `recipientCount` est le nombre de personnes qui ne verront le message qu’en ouvrant l’application.
  @JsonKey(name: r'reachableCount', required: true, includeIfNull: false)
  final num reachableCount;

  /// Faux quand aucun compte de service FCM n’est configuré.
  @JsonKey(name: r'transportConfigured', required: true, includeIfNull: false)
  final bool transportConfigured;

  @JsonKey(name: r'transportReason', required: true, includeIfNull: true)
  final String? transportReason;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is AudiencePreviewDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                recipientCount,
                reachableCount,
                transportConfigured,
                transportReason,
              ],
              [
                other.recipientCount,
                other.reachableCount,
                other.transportConfigured,
                other.transportReason,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        recipientCount,
        reachableCount,
        transportConfigured,
        transportReason,
      ]);

  factory AudiencePreviewDto.fromJson(Map<String, dynamic> json) =>
      _$AudiencePreviewDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AudiencePreviewDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
