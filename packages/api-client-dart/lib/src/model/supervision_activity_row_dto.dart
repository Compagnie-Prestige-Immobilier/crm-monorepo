//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'supervision_activity_row_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SupervisionActivityRowDto {
  /// Returns a new [SupervisionActivityRowDto] instance.
  SupervisionActivityRowDto({
    required this.bucket,

    required this.teleconseillerId,

    required this.teleconseillerName,

    required this.calls,

    required this.unreachable,

    required this.wrongNumber,

    required this.refused,

    required this.other,

    required this.methodObtained,

    required this.callback,

    required this.reachRate,

    required this.prospectsCreated,

    required this.representantsContacted,

    required this.tasksClosed,
  });

  /// Début de la journée ou de la semaine, en AAAA-MM-JJ.
  @JsonKey(name: r'bucket', required: true, includeIfNull: false)
  final String bucket;

  @JsonKey(name: r'teleconseillerId', required: true, includeIfNull: false)
  final String teleconseillerId;

  @JsonKey(name: r'teleconseillerName', required: true, includeIfNull: false)
  final String teleconseillerName;

  /// Appels passés à des prospects.
  @JsonKey(name: r'calls', required: true, includeIfNull: false)
  final num calls;

  /// Issue UNREACHABLE : NRP ou injoignable.
  @JsonKey(name: r'unreachable', required: true, includeIfNull: false)
  final num unreachable;

  /// Issue WRONG_NUMBER : faux numéro.
  @JsonKey(name: r'wrongNumber', required: true, includeIfNull: false)
  final num wrongNumber;

  /// Issue REFUSED : refus.
  @JsonKey(name: r'refused', required: true, includeIfNull: false)
  final num refused;

  /// Issue OTHER.
  @JsonKey(name: r'other', required: true, includeIfNull: false)
  final num other;

  /// Issue METHOD_OBTAINED.
  @JsonKey(name: r'methodObtained', required: true, includeIfNull: false)
  final num methodObtained;

  /// Issue CALLBACK : à rappeler.
  @JsonKey(name: r'callback', required: true, includeIfNull: false)
  final num callback;

  /// Part des appels dont le numéro s’est révélé exploitable, en pourcentage. `null` sans aucun appel : « personne appelé » n’est pas « personne joint ».
  @JsonKey(name: r'reachRate', required: true, includeIfNull: true)
  final num? reachRate;

  /// Fiches prospect saisies sur la période.
  @JsonKey(name: r'prospectsCreated', required: true, includeIfNull: false)
  final num prospectsCreated;

  /// Représentants distincts appelés sur la période.
  @JsonKey(
    name: r'representantsContacted',
    required: true,
    includeIfNull: false,
  )
  final num representantsContacted;

  /// Tâches d’appel clôturées sur la période.
  @JsonKey(name: r'tasksClosed', required: true, includeIfNull: false)
  final num tasksClosed;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SupervisionActivityRowDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                bucket,
                teleconseillerId,
                teleconseillerName,
                calls,
                unreachable,
                wrongNumber,
                refused,
                other,
                methodObtained,
                callback,
                reachRate,
                prospectsCreated,
                representantsContacted,
                tasksClosed,
              ],
              [
                other.bucket,
                other.teleconseillerId,
                other.teleconseillerName,
                other.calls,
                other.unreachable,
                other.wrongNumber,
                other.refused,
                other.other,
                other.methodObtained,
                other.callback,
                other.reachRate,
                other.prospectsCreated,
                other.representantsContacted,
                other.tasksClosed,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        bucket,
        teleconseillerId,
        teleconseillerName,
        calls,
        unreachable,
        wrongNumber,
        refused,
        other,
        methodObtained,
        callback,
        reachRate,
        prospectsCreated,
        representantsContacted,
        tasksClosed,
      ]);

  factory SupervisionActivityRowDto.fromJson(Map<String, dynamic> json) =>
      _$SupervisionActivityRowDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisionActivityRowDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
