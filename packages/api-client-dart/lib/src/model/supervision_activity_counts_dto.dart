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

    required this.confirmedCalls,

    required this.detectedCalls,

    required this.unloggedCalls,

    required this.avgCallSeconds,

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

    required this.repConfirmedCalls,

    required this.repDetectedCalls,

    required this.repUnloggedCalls,

    required this.repAvgCallSeconds,

    required this.repWrongNumber,

    required this.repReached,

    required this.repCallback,

    required this.repUnreachable,

    required this.repOther,

    required this.repContactRate,

    required this.repCallbackRate,

    required this.repQuestioned,

    required this.repQualified,

    required this.repQualificationRate,

    required this.inboundCalls,

    required this.missedCalls,

    required this.callbacksHonored,

    required this.callbacksLate,

    required this.callbacksUpcoming,

    required this.repCallbacksHonored,

    required this.repCallbacksLate,

    required this.repCallbacksUpcoming,
  });

  /// Appels passés à des prospects.
  @JsonKey(name: r'calls', required: true, includeIfNull: false)
  final num calls;

  /// Parmi `calls`, ceux retrouvés dans le journal d’appels du téléphone Android. Un appel passé depuis un autre téléphone ou saisi après coup n’y est pas.
  @JsonKey(name: r'confirmedCalls', required: true, includeIfNull: false)
  final num confirmedCalls;

  /// Appels vers un prospect que le journal du téléphone a relevés, consignés ou non.
  @JsonKey(name: r'detectedCalls', required: true, includeIfNull: false)
  final num detectedCalls;

  /// Parmi `detectedCalls`, ceux qu’aucune tentative ne consigne. C’est le chiffre qui déclenche l’alerte de supervision.
  @JsonKey(name: r'unloggedCalls', required: true, includeIfNull: false)
  final num unloggedCalls;

  /// Durée moyenne, en secondes, des `confirmedCalls`. `null` quand aucun appel prospect n’a été retrouvé au journal du téléphone.
  @JsonKey(name: r'avgCallSeconds', required: true, includeIfNull: true)
  final num? avgCallSeconds;

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

  /// Appels à des représentants, issues encore saisissables : REACHED, REFUSED, CALLBACK, UNREACHABLE, WRONG_NUMBER.
  @JsonKey(name: r'repCalls', required: true, includeIfNull: false)
  final num repCalls;

  /// Parmi `repCalls`, ceux retrouvés dans le journal d’appels du téléphone Android.
  @JsonKey(name: r'repConfirmedCalls', required: true, includeIfNull: false)
  final num repConfirmedCalls;

  /// Appels vers un représentant que le journal du téléphone a relevés, consignés ou non.
  @JsonKey(name: r'repDetectedCalls', required: true, includeIfNull: false)
  final num repDetectedCalls;

  /// Parmi `repDetectedCalls`, ceux qu’aucune tentative ne consigne.
  @JsonKey(name: r'repUnloggedCalls', required: true, includeIfNull: false)
  final num repUnloggedCalls;

  /// Durée moyenne, en secondes, des `repConfirmedCalls`. `null` quand aucun appel représentant n’a été retrouvé au journal du téléphone.
  @JsonKey(name: r'repAvgCallSeconds', required: true, includeIfNull: true)
  final num? repAvgCallSeconds;

  /// Issue WRONG_NUMBER : faux numéro parmi les appels représentants.
  @JsonKey(name: r'repWrongNumber', required: true, includeIfNull: false)
  final num repWrongNumber;

  /// Représentants qui ont DÉCROCHÉ et répondu : REACHED ou REFUSED. Un refus est un contact ; un rappel promis n’en est pas encore un.
  @JsonKey(name: r'repReached', required: true, includeIfNull: false)
  final num repReached;

  /// Issue CALLBACK : rappel promis, date posée.
  @JsonKey(name: r'repCallback', required: true, includeIfNull: false)
  final num repCallback;

  /// Issue UNREACHABLE : n’a pas décroché.
  @JsonKey(name: r'repUnreachable', required: true, includeIfNull: false)
  final num repUnreachable;

  /// Issues d’héritage que le terrain ne saisit plus : PROSPECTS_PROMISED, OTHER. Hors de tous les taux.
  @JsonKey(name: r'repOther', required: true, includeIfNull: false)
  final num repOther;

  /// Part des appels représentants où quelqu’un a répondu, en pourcentage. `null` sans aucun appel.
  @JsonKey(name: r'repContactRate', required: true, includeIfNull: true)
  final num? repContactRate;

  /// Part des appels représentants finissant en rappel, en pourcentage. Dénominateur : appels hors faux numéro.
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

  /// Appels entrants relevés au journal du téléphone, les deux familles confondues. Une détection déjà consignée n’est comptée qu’une fois, par sa tentative.
  @JsonKey(name: r'inboundCalls', required: true, includeIfNull: false)
  final num inboundCalls;

  /// Appels manqués relevés au journal du téléphone, les deux familles confondues.
  @JsonKey(name: r'missedCalls', required: true, includeIfNull: false)
  final num missedCalls;

  /// Rappels prospects promis pour cette période et tenus : une tentative les a clos. Comptés sur la date PROMISE, pas sur celle de l’appel qui les a posés.
  @JsonKey(name: r'callbacksHonored', required: true, includeIfNull: false)
  final num callbacksHonored;

  /// Rappels prospects dont l’heure est passée et qu’aucune tentative n’a clos.
  @JsonKey(name: r'callbacksLate', required: true, includeIfNull: false)
  final num callbacksLate;

  /// Rappels prospects encore à venir.
  @JsonKey(name: r'callbacksUpcoming', required: true, includeIfNull: false)
  final num callbacksUpcoming;

  /// Rappels représentants tenus : un appel a suivi l’heure promise, quel qu’en soit l’auteur.
  @JsonKey(name: r'repCallbacksHonored', required: true, includeIfNull: false)
  final num repCallbacksHonored;

  /// Rappels représentants dont l’heure est passée sans qu’aucun appel ait suivi.
  @JsonKey(name: r'repCallbacksLate', required: true, includeIfNull: false)
  final num repCallbacksLate;

  /// Rappels représentants encore à venir.
  @JsonKey(name: r'repCallbacksUpcoming', required: true, includeIfNull: false)
  final num repCallbacksUpcoming;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SupervisionActivityCountsDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                calls,
                confirmedCalls,
                detectedCalls,
                unloggedCalls,
                avgCallSeconds,
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
                repConfirmedCalls,
                repDetectedCalls,
                repUnloggedCalls,
                repAvgCallSeconds,
                repWrongNumber,
                repReached,
                repCallback,
                repUnreachable,
                repOther,
                repContactRate,
                repCallbackRate,
                repQuestioned,
                repQualified,
                repQualificationRate,
                inboundCalls,
                missedCalls,
                callbacksHonored,
                callbacksLate,
                callbacksUpcoming,
                repCallbacksHonored,
                repCallbacksLate,
                repCallbacksUpcoming,
              ],
              [
                other.calls,
                other.confirmedCalls,
                other.detectedCalls,
                other.unloggedCalls,
                other.avgCallSeconds,
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
                other.repConfirmedCalls,
                other.repDetectedCalls,
                other.repUnloggedCalls,
                other.repAvgCallSeconds,
                other.repWrongNumber,
                other.repReached,
                other.repCallback,
                other.repUnreachable,
                other.repOther,
                other.repContactRate,
                other.repCallbackRate,
                other.repQuestioned,
                other.repQualified,
                other.repQualificationRate,
                other.inboundCalls,
                other.missedCalls,
                other.callbacksHonored,
                other.callbacksLate,
                other.callbacksUpcoming,
                other.repCallbacksHonored,
                other.repCallbacksLate,
                other.repCallbacksUpcoming,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        calls,
        confirmedCalls,
        detectedCalls,
        unloggedCalls,
        avgCallSeconds,
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
        repConfirmedCalls,
        repDetectedCalls,
        repUnloggedCalls,
        repAvgCallSeconds,
        repWrongNumber,
        repReached,
        repCallback,
        repUnreachable,
        repOther,
        repContactRate,
        repCallbackRate,
        repQuestioned,
        repQualified,
        repQualificationRate,
        inboundCalls,
        missedCalls,
        callbacksHonored,
        callbacksLate,
        callbacksUpcoming,
        repCallbacksHonored,
        repCallbacksLate,
        repCallbacksUpcoming,
      ]);

  factory SupervisionActivityCountsDto.fromJson(Map<String, dynamic> json) =>
      _$SupervisionActivityCountsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisionActivityCountsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
