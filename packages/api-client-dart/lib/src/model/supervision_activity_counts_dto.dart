//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'supervision_activity_counts_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SupervisionActivityCountsDto {
  /// Returns a new [SupervisionActivityCountsDto] instance.
  SupervisionActivityCountsDto({
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

    required this.repCalls,

    required this.repReached,

    required this.repCallback,

    required this.repUnreachable,

    required this.repOther,

    required this.repContactRate,

    required this.repCallbackRate,

    required this.repQuestioned,

    required this.repQualified,

    required this.repQualificationRate,
  });

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

  /// Appels à des représentants, issues encore saisissables seulement : REACHED, REFUSED, CALLBACK, UNREACHABLE. Dénominateur de `repContactRate` et de `repCallbackRate`.
  @JsonKey(name: r'repCalls', required: true, includeIfNull: false)
  final num repCalls;

  /// Représentants qui ont DÉCROCHÉ et répondu : REACHED ou REFUSED. Un refus est un contact ; un rappel promis n’en est pas encore un.
  @JsonKey(name: r'repReached', required: true, includeIfNull: false)
  final num repReached;

  /// Issue CALLBACK : rappel promis, date posée.
  @JsonKey(name: r'repCallback', required: true, includeIfNull: false)
  final num repCallback;

  /// Issue UNREACHABLE : n’a pas décroché.
  @JsonKey(name: r'repUnreachable', required: true, includeIfNull: false)
  final num repUnreachable;

  /// Issues d’héritage que le terrain ne saisit plus : PROSPECTS_PROMISED, WRONG_NUMBER, OTHER. Hors de tous les taux.
  @JsonKey(name: r'repOther', required: true, includeIfNull: false)
  final num repOther;

  /// Part des appels représentants où quelqu’un a répondu, en pourcentage. `null` sans aucun appel.
  @JsonKey(name: r'repContactRate', required: true, includeIfNull: true)
  final num? repContactRate;

  /// Part des appels représentants finissant en rappel, en pourcentage.
  @JsonKey(name: r'repCallbackRate', required: true, includeIfNull: true)
  final num? repCallbackRate;

  /// Représentants DISTINCTS dont la dernière réponse de la fenêtre a été obtenue par ce téléconseiller. Attribué à qui a obtenu la réponse, pas à qui a appelé le premier. NON SOMMABLE entre périodes ni entre téléconseillers.
  @JsonKey(name: r'repQuestioned', required: true, includeIfNull: false)
  final num repQuestioned;

  /// Parmi `repQuestioned`, ceux dont cette dernière réponse est REACHED. NON SOMMABLE.
  @JsonKey(name: r'repQualified', required: true, includeIfNull: false)
  final num repQualified;

  /// Part des représentants interrogés qui ont dit oui, en pourcentage. `null` sans aucun représentant interrogé.
  @JsonKey(name: r'repQualificationRate', required: true, includeIfNull: true)
  final num? repQualificationRate;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SupervisionActivityCountsDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
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
                repCalls,
                repReached,
                repCallback,
                repUnreachable,
                repOther,
                repContactRate,
                repCallbackRate,
                repQuestioned,
                repQualified,
                repQualificationRate,
              ],
              [
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
                other.repCalls,
                other.repReached,
                other.repCallback,
                other.repUnreachable,
                other.repOther,
                other.repContactRate,
                other.repCallbackRate,
                other.repQuestioned,
                other.repQualified,
                other.repQualificationRate,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
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
        repCalls,
        repReached,
        repCallback,
        repUnreachable,
        repOther,
        repContactRate,
        repCallbackRate,
        repQuestioned,
        repQualified,
        repQualificationRate,
      ]);

  factory SupervisionActivityCountsDto.fromJson(Map<String, dynamic> json) =>
      _$SupervisionActivityCountsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisionActivityCountsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
