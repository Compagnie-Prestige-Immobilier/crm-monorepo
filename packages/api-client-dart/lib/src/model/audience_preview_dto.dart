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
  AudiencePreviewDto({required this.recipientCount});

  /// Comptes actifs visés. Tous liront la notification dans l’application : il n’y a plus de « joignable » distinct de « visé ».
  @JsonKey(name: r'recipientCount', required: true, includeIfNull: false)
  final num recipientCount;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is AudiencePreviewDto &&
            runtimeType == other.runtimeType &&
            equals([recipientCount], [other.recipientCount]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([recipientCount]);

  factory AudiencePreviewDto.fromJson(Map<String, dynamic> json) =>
      _$AudiencePreviewDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AudiencePreviewDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
