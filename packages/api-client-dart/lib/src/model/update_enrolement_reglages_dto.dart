//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_enrolement_reglages_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateEnrolementReglagesDto {
  /// Returns a new [UpdateEnrolementReglagesDto] instance.
  UpdateEnrolementReglagesDto({this.frequenceMinutes, this.repriseDepuis});

  /// Absente, la fréquence reste inchangée. À l’usine : 15 minutes.
  // minimum: 5
  // maximum: 1440
  @JsonKey(name: r'frequenceMinutes', required: false, includeIfNull: false)
  final num? frequenceMinutes;

  /// Chaîne vide pour reprendre tout l’historique.
  @JsonKey(name: r'repriseDepuis', required: false, includeIfNull: false)
  final DateTime? repriseDepuis;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateEnrolementReglagesDto &&
            runtimeType == other.runtimeType &&
            equals(
              [frequenceMinutes, repriseDepuis],
              [other.frequenceMinutes, other.repriseDepuis],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([frequenceMinutes, repriseDepuis]);

  factory UpdateEnrolementReglagesDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateEnrolementReglagesDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateEnrolementReglagesDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
