//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
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

    required this.lastWriteAt,

    required this.activeSecondsToday,

    required this.firstSeenToday,

    required this.callsToday,

    required this.medianGapSeconds,

    required this.medianUploadLagSeconds,

    required this.firstCallAt,
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

  /// Dernière écriture métier : tentative d’appel ou transition de dossier. Cherchée sur les 31 derniers jours seulement ; au-delà, vaut null.
  @JsonKey(name: r'lastWriteAt', required: true, includeIfNull: true)
  final DateTime? lastWriteAt;

  /// Temps actif observé aujourd’hui, en secondes. Les interruptions de plus de 90 secondes ne sont pas comptées.
  @JsonKey(name: r'activeSecondsToday', required: true, includeIfNull: false)
  final num activeSecondsToday;

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
                lastWriteAt,
                activeSecondsToday,
                firstSeenToday,
                callsToday,
                medianGapSeconds,
                medianUploadLagSeconds,
                firstCallAt,
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
                other.lastWriteAt,
                other.activeSecondsToday,
                other.firstSeenToday,
                other.callsToday,
                other.medianGapSeconds,
                other.medianUploadLagSeconds,
                other.firstCallAt,
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
        lastWriteAt,
        activeSecondsToday,
        firstSeenToday,
        callsToday,
        medianGapSeconds,
        medianUploadLagSeconds,
        firstCallAt,
      ]);

  factory SupervisedUserDto.fromJson(Map<String, dynamic> json) =>
      _$SupervisedUserDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SupervisedUserDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
