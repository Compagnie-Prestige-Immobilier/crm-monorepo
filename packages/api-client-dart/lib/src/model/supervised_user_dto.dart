//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/performance_score.dart';
import 'package:crm_api_client/src/model/presence_state.dart';
import 'package:crm_api_client/src/model/role.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'supervised_user_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SupervisedUserDto {
  /// Returns a new [SupervisedUserDto] instance.
  SupervisedUserDto({
    required this.id,

    required this.fullName,

    required this.username,

    required this.email,

    required this.role,

    required this.isActive,

    required this.presence,

    required this.hasLiveSession,

    required this.sessionCount,

    required this.lastSeenAt,

    required this.lastLoginAt,

    required this.lastSyncAt,

    required this.lastPullAt,

    required this.pendingOps,

    required this.appVersion,

    required this.journalAppelsAutorise,

    required this.lastWriteAt,

    required this.activeSecondsToday,

    required this.activeSecondsInShifts,

    required this.firstSeenToday,

    required this.callsToday,

    required this.medianGapSeconds,

    required this.medianUploadLagSeconds,

    required this.firstCallAt,

    required this.lastCallAt,

    required this.reachedToday,

    required this.qualifiedToday,

    required this.repeatCalls,

    required this.deadSeconds,

    required this.deadGaps,

    required this.score,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'fullName', required: true, includeIfNull: false)
  final String fullName;

  @JsonKey(name: r'username', required: true, includeIfNull: false)
  final String username;

  @JsonKey(name: r'email', required: true, includeIfNull: false)
  final String email;

  @JsonKey(
    name: r'role',
    required: true,
    includeIfNull: false,
    unknownEnumValue: Role.unknownDefaultOpenApi,
  )
  final Role role;

  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  @JsonKey(
    name: r'presence',
    required: true,
    includeIfNull: false,
    unknownEnumValue: PresenceState.unknownDefaultOpenApi,
  )
  final PresenceState presence;

  /// Une famille de jetons est encore vivante : ni révoquée, ni expirée.
  @JsonKey(name: r'hasLiveSession', required: true, includeIfNull: false)
  final bool hasLiveSession;

  /// Sessions ouvertes, tous appareils confondus.
  @JsonKey(name: r'sessionCount', required: true, includeIfNull: false)
  final num sessionCount;

  /// Trace d’activité la plus récente, toutes sources confondues.
  @JsonKey(name: r'lastSeenAt', required: true, includeIfNull: true)
  final DateTime? lastSeenAt;

  @JsonKey(name: r'lastLoginAt', required: true, includeIfNull: true)
  final DateTime? lastLoginAt;

  /// Dernier lot de synchronisation reçu d’un appareil.
  @JsonKey(name: r'lastSyncAt', required: true, includeIfNull: true)
  final DateTime? lastSyncAt;

  /// Dernière synchronisation descendante. Un appareil ouvert appelle toutes les minutes, même quand il n’a rien à remonter.
  @JsonKey(name: r'lastPullAt', required: true, includeIfNull: true)
  final DateTime? lastPullAt;

  /// Opérations en attente de remontée dans l’appareil, DÉCLARÉES PAR LUI. `null` quand l’application ne les annonce pas : le serveur ne voit pas ce qui dort dans un téléphone.
  @JsonKey(name: r'pendingOps', required: true, includeIfNull: true)
  final num? pendingOps;

  /// Version de l’application mobile, telle qu’elle s’annonce.
  @JsonKey(name: r'appVersion', required: true, includeIfNull: true)
  final String? appVersion;

  /// Lecture du journal d’appels accordée sur l’appareil, DÉCLARÉE PAR LUI. `false` : la durée de communication de ce compte ne se mesure pas. `null` : inconnu.
  @JsonKey(name: r'journalAppelsAutorise', required: true, includeIfNull: true)
  final bool? journalAppelsAutorise;

  /// Dernière écriture métier : tentative d’appel ou transition de dossier. Cherchée sur les 31 derniers jours seulement ; au-delà, vaut null.
  @JsonKey(name: r'lastWriteAt', required: true, includeIfNull: true)
  final DateTime? lastWriteAt;

  /// Temps actif observé aujourd’hui, en secondes. Les interruptions de plus de 90 secondes ne sont pas comptées.
  @JsonKey(name: r'activeSecondsToday', required: true, includeIfNull: false)
  final num activeSecondsToday;

  /// Part du temps actif tombée dans les créneaux de travail, en secondes. La présence est découpée à l’heure : une tranche compte dès que son heure de début appartient à un créneau, donc un créneau réglé à une demi-heure compte l’heure entière.
  @JsonKey(name: r'activeSecondsInShifts', required: true, includeIfNull: false)
  final num activeSecondsInShifts;

  @JsonKey(name: r'firstSeenToday', required: true, includeIfNull: true)
  final DateTime? firstSeenToday;

  /// Tentatives d’appel du jour, prospects et représentants confondus, comptées sur l’heure de l’appel et non sur celle de la remontée.
  @JsonKey(name: r'callsToday', required: true, includeIfNull: false)
  final num callsToday;

  /// Médiane, en secondes, de l’écart entre deux tentatives consécutives du jour. `null` en deçà de deux tentatives : un écart n’existe pas encore.
  @JsonKey(name: r'medianGapSeconds', required: true, includeIfNull: true)
  final num? medianGapSeconds;

  /// Médiane, en secondes, du retard de remontée : temps écoulé entre l’appel sur le téléphone et son arrivée au serveur. Négatif quand l’horloge du téléphone avance sur celle du serveur. `null` sans aucune tentative du jour.
  @JsonKey(name: r'medianUploadLagSeconds', required: true, includeIfNull: true)
  final num? medianUploadLagSeconds;

  @JsonKey(name: r'firstCallAt', required: true, includeIfNull: true)
  final DateTime? firstCallAt;

  /// Dernière tentative du jour. Avec `firstCallAt`, donne l’amplitude de la journée.
  @JsonKey(name: r'lastCallAt', required: true, includeIfNull: true)
  final DateTime? lastCallAt;

  /// Appels du jour ayant obtenu une réponse : prospect joignable (toute issue hors numéro injoignable ou faux numéro) et représentant qui a décroché, qu’il dise oui ou non.
  @JsonKey(name: r'reachedToday', required: true, includeIfNull: false)
  final num reachedToday;

  /// Appels du jour ayant abouti : méthode obtenue côté prospect, représentant qualifié côté représentant. Un représentant appelé plusieurs fois ne compte qu’une fois, sur sa dernière réponse du jour.
  @JsonKey(name: r'qualifiedToday', required: true, includeIfNull: false)
  final num qualifiedToday;

  /// Appels du jour au-delà du premier sur une même fiche. Zéro quand chaque fiche n’a été appelée qu’une fois.
  @JsonKey(name: r'repeatCalls', required: true, includeIfNull: false)
  final num repeatCalls;

  /// Temps mort, en secondes : somme des écarts de plus de quinze minutes entre deux appels consécutifs tombant dans le MÊME créneau. La pause entre les deux créneaux n’en est pas un.
  @JsonKey(name: r'deadSeconds', required: true, includeIfNull: false)
  final num deadSeconds;

  /// Nombre de trous comptés dans `deadSeconds`.
  @JsonKey(name: r'deadGaps', required: true, includeIfNull: false)
  final num deadGaps;

  @JsonKey(name: r'score', required: true, includeIfNull: false)
  final PerformanceScore score;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SupervisedUserDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                fullName,
                username,
                email,
                role,
                isActive,
                presence,
                hasLiveSession,
                sessionCount,
                lastSeenAt,
                lastLoginAt,
                lastSyncAt,
                lastPullAt,
                pendingOps,
                appVersion,
                journalAppelsAutorise,
                lastWriteAt,
                activeSecondsToday,
                activeSecondsInShifts,
                firstSeenToday,
                callsToday,
                medianGapSeconds,
                medianUploadLagSeconds,
                firstCallAt,
                lastCallAt,
                reachedToday,
                qualifiedToday,
                repeatCalls,
                deadSeconds,
                deadGaps,
                score,
              ],
              [
                other.id,
                other.fullName,
                other.username,
                other.email,
                other.role,
                other.isActive,
                other.presence,
                other.hasLiveSession,
                other.sessionCount,
                other.lastSeenAt,
                other.lastLoginAt,
                other.lastSyncAt,
                other.lastPullAt,
                other.pendingOps,
                other.appVersion,
                other.journalAppelsAutorise,
                other.lastWriteAt,
                other.activeSecondsToday,
                other.activeSecondsInShifts,
                other.firstSeenToday,
                other.callsToday,
                other.medianGapSeconds,
                other.medianUploadLagSeconds,
                other.firstCallAt,
                other.lastCallAt,
                other.reachedToday,
                other.qualifiedToday,
                other.repeatCalls,
                other.deadSeconds,
                other.deadGaps,
                other.score,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        fullName,
        username,
        email,
        role,
        isActive,
        presence,
        hasLiveSession,
        sessionCount,
        lastSeenAt,
        lastLoginAt,
        lastSyncAt,
        lastPullAt,
        pendingOps,
        appVersion,
        journalAppelsAutorise,
        lastWriteAt,
        activeSecondsToday,
        activeSecondsInShifts,
        firstSeenToday,
        callsToday,
        medianGapSeconds,
        medianUploadLagSeconds,
        firstCallAt,
        lastCallAt,
        reachedToday,
        qualifiedToday,
        repeatCalls,
        deadSeconds,
        deadGaps,
        score,
      ]);

  factory SupervisedUserDto.fromJson(Map<String, dynamic> json) =>
      _$SupervisedUserDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisedUserDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
