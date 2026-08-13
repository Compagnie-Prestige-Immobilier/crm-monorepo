//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/presence_counts_dto.dart';
import 'package:crm_api_client/src/model/supervised_user_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'supervision_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SupervisionDto {
  /// Returns a new [SupervisionDto] instance.
  SupervisionDto({
    required this.observedAt,

    this.onlineWindowMinutes = 20,

    required this.teleconseillers,

    required this.finances,

    required this.counts,
  });

  /// Horloge du serveur au moment de la lecture.
  @JsonKey(name: r'observedAt', required: true, includeIfNull: false)
  final DateTime observedAt;

  /// Fenêtre, en minutes, en deçà de laquelle un compte est dit connecté.
  @JsonKey(
    defaultValue: 20,
    name: r'onlineWindowMinutes',
    required: true,
    includeIfNull: false,
  )
  final num onlineWindowMinutes;

  @JsonKey(name: r'teleconseillers', required: true, includeIfNull: false)
  final List<SupervisedUserDto> teleconseillers;

  @JsonKey(name: r'finances', required: true, includeIfNull: false)
  final List<SupervisedUserDto> finances;

  @JsonKey(name: r'counts', required: true, includeIfNull: false)
  final PresenceCountsDto counts;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SupervisionDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                observedAt,
                onlineWindowMinutes,
                teleconseillers,
                finances,
                counts,
              ],
              [
                other.observedAt,
                other.onlineWindowMinutes,
                other.teleconseillers,
                other.finances,
                other.counts,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        observedAt,
        onlineWindowMinutes,
        teleconseillers,
        finances,
        counts,
      ]);

  factory SupervisionDto.fromJson(Map<String, dynamic> json) =>
      _$SupervisionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
