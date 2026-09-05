// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supervised_user_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SupervisedUserDtoCWProxy {
  SupervisedUserDto id(String id);

  SupervisedUserDto fullName(String fullName);

  SupervisedUserDto username(String username);

  SupervisedUserDto email(String email);

  SupervisedUserDto role(Role role);

  SupervisedUserDto isActive(bool isActive);

  SupervisedUserDto presence(PresenceState presence);

  SupervisedUserDto hasLiveSession(bool hasLiveSession);

  SupervisedUserDto sessionCount(num sessionCount);

  SupervisedUserDto lastSeenAt(DateTime? lastSeenAt);

  SupervisedUserDto lastLoginAt(DateTime? lastLoginAt);

  SupervisedUserDto lastSyncAt(DateTime? lastSyncAt);

  SupervisedUserDto lastPullAt(DateTime? lastPullAt);

  SupervisedUserDto pendingOps(num? pendingOps);

  SupervisedUserDto appVersion(String? appVersion);

  SupervisedUserDto journalAppelsAutorise(bool? journalAppelsAutorise);

  SupervisedUserDto lastWriteAt(DateTime? lastWriteAt);

  SupervisedUserDto activeSecondsToday(num activeSecondsToday);

  SupervisedUserDto activeSecondsInShifts(num activeSecondsInShifts);

  SupervisedUserDto firstSeenToday(DateTime? firstSeenToday);

  SupervisedUserDto callsToday(num callsToday);

  SupervisedUserDto medianGapSeconds(num? medianGapSeconds);

  SupervisedUserDto medianUploadLagSeconds(num? medianUploadLagSeconds);

  SupervisedUserDto firstCallAt(DateTime? firstCallAt);

  SupervisedUserDto lastCallAt(DateTime? lastCallAt);

  SupervisedUserDto reachedToday(num reachedToday);

  SupervisedUserDto qualifiedToday(num qualifiedToday);

  SupervisedUserDto repeatCalls(num repeatCalls);

  SupervisedUserDto deadSeconds(num deadSeconds);

  SupervisedUserDto deadGaps(num deadGaps);

  SupervisedUserDto score(PerformanceScore score);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisedUserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisedUserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisedUserDto call({
    String id,
    String fullName,
    String username,
    String email,
    Role role,
    bool isActive,
    PresenceState presence,
    bool hasLiveSession,
    num sessionCount,
    DateTime? lastSeenAt,
    DateTime? lastLoginAt,
    DateTime? lastSyncAt,
    DateTime? lastPullAt,
    num? pendingOps,
    String? appVersion,
    bool? journalAppelsAutorise,
    DateTime? lastWriteAt,
    num activeSecondsToday,
    num activeSecondsInShifts,
    DateTime? firstSeenToday,
    num callsToday,
    num? medianGapSeconds,
    num? medianUploadLagSeconds,
    DateTime? firstCallAt,
    DateTime? lastCallAt,
    num reachedToday,
    num qualifiedToday,
    num repeatCalls,
    num deadSeconds,
    num deadGaps,
    PerformanceScore score,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSupervisedUserDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSupervisedUserDto.copyWith.fieldName(...)`
class _$SupervisedUserDtoCWProxyImpl implements _$SupervisedUserDtoCWProxy {
  const _$SupervisedUserDtoCWProxyImpl(this._value);

  final SupervisedUserDto _value;

  @override
  SupervisedUserDto id(String id) => this(id: id);

  @override
  SupervisedUserDto fullName(String fullName) => this(fullName: fullName);

  @override
  SupervisedUserDto username(String username) => this(username: username);

  @override
  SupervisedUserDto email(String email) => this(email: email);

  @override
  SupervisedUserDto role(Role role) => this(role: role);

  @override
  SupervisedUserDto isActive(bool isActive) => this(isActive: isActive);

  @override
  SupervisedUserDto presence(PresenceState presence) =>
      this(presence: presence);

  @override
  SupervisedUserDto hasLiveSession(bool hasLiveSession) =>
      this(hasLiveSession: hasLiveSession);

  @override
  SupervisedUserDto sessionCount(num sessionCount) =>
      this(sessionCount: sessionCount);

  @override
  SupervisedUserDto lastSeenAt(DateTime? lastSeenAt) =>
      this(lastSeenAt: lastSeenAt);

  @override
  SupervisedUserDto lastLoginAt(DateTime? lastLoginAt) =>
      this(lastLoginAt: lastLoginAt);

  @override
  SupervisedUserDto lastSyncAt(DateTime? lastSyncAt) =>
      this(lastSyncAt: lastSyncAt);

  @override
  SupervisedUserDto lastPullAt(DateTime? lastPullAt) =>
      this(lastPullAt: lastPullAt);

  @override
  SupervisedUserDto pendingOps(num? pendingOps) => this(pendingOps: pendingOps);

  @override
  SupervisedUserDto appVersion(String? appVersion) =>
      this(appVersion: appVersion);

  @override
  SupervisedUserDto journalAppelsAutorise(bool? journalAppelsAutorise) =>
      this(journalAppelsAutorise: journalAppelsAutorise);

  @override
  SupervisedUserDto lastWriteAt(DateTime? lastWriteAt) =>
      this(lastWriteAt: lastWriteAt);

  @override
  SupervisedUserDto activeSecondsToday(num activeSecondsToday) =>
      this(activeSecondsToday: activeSecondsToday);

  @override
  SupervisedUserDto activeSecondsInShifts(num activeSecondsInShifts) =>
      this(activeSecondsInShifts: activeSecondsInShifts);

  @override
  SupervisedUserDto firstSeenToday(DateTime? firstSeenToday) =>
      this(firstSeenToday: firstSeenToday);

  @override
  SupervisedUserDto callsToday(num callsToday) => this(callsToday: callsToday);

  @override
  SupervisedUserDto medianGapSeconds(num? medianGapSeconds) =>
      this(medianGapSeconds: medianGapSeconds);

  @override
  SupervisedUserDto medianUploadLagSeconds(num? medianUploadLagSeconds) =>
      this(medianUploadLagSeconds: medianUploadLagSeconds);

  @override
  SupervisedUserDto firstCallAt(DateTime? firstCallAt) =>
      this(firstCallAt: firstCallAt);

  @override
  SupervisedUserDto lastCallAt(DateTime? lastCallAt) =>
      this(lastCallAt: lastCallAt);

  @override
  SupervisedUserDto reachedToday(num reachedToday) =>
      this(reachedToday: reachedToday);

  @override
  SupervisedUserDto qualifiedToday(num qualifiedToday) =>
      this(qualifiedToday: qualifiedToday);

  @override
  SupervisedUserDto repeatCalls(num repeatCalls) =>
      this(repeatCalls: repeatCalls);

  @override
  SupervisedUserDto deadSeconds(num deadSeconds) =>
      this(deadSeconds: deadSeconds);

  @override
  SupervisedUserDto deadGaps(num deadGaps) => this(deadGaps: deadGaps);

  @override
  SupervisedUserDto score(PerformanceScore score) => this(score: score);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisedUserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisedUserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisedUserDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? username = const $CopyWithPlaceholder(),
    Object? email = const $CopyWithPlaceholder(),
    Object? role = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? presence = const $CopyWithPlaceholder(),
    Object? hasLiveSession = const $CopyWithPlaceholder(),
    Object? sessionCount = const $CopyWithPlaceholder(),
    Object? lastSeenAt = const $CopyWithPlaceholder(),
    Object? lastLoginAt = const $CopyWithPlaceholder(),
    Object? lastSyncAt = const $CopyWithPlaceholder(),
    Object? lastPullAt = const $CopyWithPlaceholder(),
    Object? pendingOps = const $CopyWithPlaceholder(),
    Object? appVersion = const $CopyWithPlaceholder(),
    Object? journalAppelsAutorise = const $CopyWithPlaceholder(),
    Object? lastWriteAt = const $CopyWithPlaceholder(),
    Object? activeSecondsToday = const $CopyWithPlaceholder(),
    Object? activeSecondsInShifts = const $CopyWithPlaceholder(),
    Object? firstSeenToday = const $CopyWithPlaceholder(),
    Object? callsToday = const $CopyWithPlaceholder(),
    Object? medianGapSeconds = const $CopyWithPlaceholder(),
    Object? medianUploadLagSeconds = const $CopyWithPlaceholder(),
    Object? firstCallAt = const $CopyWithPlaceholder(),
    Object? lastCallAt = const $CopyWithPlaceholder(),
    Object? reachedToday = const $CopyWithPlaceholder(),
    Object? qualifiedToday = const $CopyWithPlaceholder(),
    Object? repeatCalls = const $CopyWithPlaceholder(),
    Object? deadSeconds = const $CopyWithPlaceholder(),
    Object? deadGaps = const $CopyWithPlaceholder(),
    Object? score = const $CopyWithPlaceholder(),
  }) {
    return SupervisedUserDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      fullName: fullName == const $CopyWithPlaceholder()
          ? _value.fullName
          // ignore: cast_nullable_to_non_nullable
          : fullName as String,
      username: username == const $CopyWithPlaceholder()
          ? _value.username
          // ignore: cast_nullable_to_non_nullable
          : username as String,
      email: email == const $CopyWithPlaceholder()
          ? _value.email
          // ignore: cast_nullable_to_non_nullable
          : email as String,
      role: role == const $CopyWithPlaceholder()
          ? _value.role
          // ignore: cast_nullable_to_non_nullable
          : role as Role,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
      presence: presence == const $CopyWithPlaceholder()
          ? _value.presence
          // ignore: cast_nullable_to_non_nullable
          : presence as PresenceState,
      hasLiveSession: hasLiveSession == const $CopyWithPlaceholder()
          ? _value.hasLiveSession
          // ignore: cast_nullable_to_non_nullable
          : hasLiveSession as bool,
      sessionCount: sessionCount == const $CopyWithPlaceholder()
          ? _value.sessionCount
          // ignore: cast_nullable_to_non_nullable
          : sessionCount as num,
      lastSeenAt: lastSeenAt == const $CopyWithPlaceholder()
          ? _value.lastSeenAt
          // ignore: cast_nullable_to_non_nullable
          : lastSeenAt as DateTime?,
      lastLoginAt: lastLoginAt == const $CopyWithPlaceholder()
          ? _value.lastLoginAt
          // ignore: cast_nullable_to_non_nullable
          : lastLoginAt as DateTime?,
      lastSyncAt: lastSyncAt == const $CopyWithPlaceholder()
          ? _value.lastSyncAt
          // ignore: cast_nullable_to_non_nullable
          : lastSyncAt as DateTime?,
      lastPullAt: lastPullAt == const $CopyWithPlaceholder()
          ? _value.lastPullAt
          // ignore: cast_nullable_to_non_nullable
          : lastPullAt as DateTime?,
      pendingOps: pendingOps == const $CopyWithPlaceholder()
          ? _value.pendingOps
          // ignore: cast_nullable_to_non_nullable
          : pendingOps as num?,
      appVersion: appVersion == const $CopyWithPlaceholder()
          ? _value.appVersion
          // ignore: cast_nullable_to_non_nullable
          : appVersion as String?,
      journalAppelsAutorise:
          journalAppelsAutorise == const $CopyWithPlaceholder()
          ? _value.journalAppelsAutorise
          // ignore: cast_nullable_to_non_nullable
          : journalAppelsAutorise as bool?,
      lastWriteAt: lastWriteAt == const $CopyWithPlaceholder()
          ? _value.lastWriteAt
          // ignore: cast_nullable_to_non_nullable
          : lastWriteAt as DateTime?,
      activeSecondsToday: activeSecondsToday == const $CopyWithPlaceholder()
          ? _value.activeSecondsToday
          // ignore: cast_nullable_to_non_nullable
          : activeSecondsToday as num,
      activeSecondsInShifts:
          activeSecondsInShifts == const $CopyWithPlaceholder()
          ? _value.activeSecondsInShifts
          // ignore: cast_nullable_to_non_nullable
          : activeSecondsInShifts as num,
      firstSeenToday: firstSeenToday == const $CopyWithPlaceholder()
          ? _value.firstSeenToday
          // ignore: cast_nullable_to_non_nullable
          : firstSeenToday as DateTime?,
      callsToday: callsToday == const $CopyWithPlaceholder()
          ? _value.callsToday
          // ignore: cast_nullable_to_non_nullable
          : callsToday as num,
      medianGapSeconds: medianGapSeconds == const $CopyWithPlaceholder()
          ? _value.medianGapSeconds
          // ignore: cast_nullable_to_non_nullable
          : medianGapSeconds as num?,
      medianUploadLagSeconds:
          medianUploadLagSeconds == const $CopyWithPlaceholder()
          ? _value.medianUploadLagSeconds
          // ignore: cast_nullable_to_non_nullable
          : medianUploadLagSeconds as num?,
      firstCallAt: firstCallAt == const $CopyWithPlaceholder()
          ? _value.firstCallAt
          // ignore: cast_nullable_to_non_nullable
          : firstCallAt as DateTime?,
      lastCallAt: lastCallAt == const $CopyWithPlaceholder()
          ? _value.lastCallAt
          // ignore: cast_nullable_to_non_nullable
          : lastCallAt as DateTime?,
      reachedToday: reachedToday == const $CopyWithPlaceholder()
          ? _value.reachedToday
          // ignore: cast_nullable_to_non_nullable
          : reachedToday as num,
      qualifiedToday: qualifiedToday == const $CopyWithPlaceholder()
          ? _value.qualifiedToday
          // ignore: cast_nullable_to_non_nullable
          : qualifiedToday as num,
      repeatCalls: repeatCalls == const $CopyWithPlaceholder()
          ? _value.repeatCalls
          // ignore: cast_nullable_to_non_nullable
          : repeatCalls as num,
      deadSeconds: deadSeconds == const $CopyWithPlaceholder()
          ? _value.deadSeconds
          // ignore: cast_nullable_to_non_nullable
          : deadSeconds as num,
      deadGaps: deadGaps == const $CopyWithPlaceholder()
          ? _value.deadGaps
          // ignore: cast_nullable_to_non_nullable
          : deadGaps as num,
      score: score == const $CopyWithPlaceholder()
          ? _value.score
          // ignore: cast_nullable_to_non_nullable
          : score as PerformanceScore,
    );
  }
}

extension $SupervisedUserDtoCopyWith on SupervisedUserDto {
  /// Returns a callable class that can be used as follows: `instanceOfSupervisedUserDto.copyWith(...)` or like so:`instanceOfSupervisedUserDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SupervisedUserDtoCWProxy get copyWith =>
      _$SupervisedUserDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupervisedUserDto _$SupervisedUserDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SupervisedUserDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'fullName',
          'username',
          'email',
          'role',
          'isActive',
          'presence',
          'hasLiveSession',
          'sessionCount',
          'lastSeenAt',
          'lastLoginAt',
          'lastSyncAt',
          'lastPullAt',
          'pendingOps',
          'appVersion',
          'journalAppelsAutorise',
          'lastWriteAt',
          'activeSecondsToday',
          'activeSecondsInShifts',
          'firstSeenToday',
          'callsToday',
          'medianGapSeconds',
          'medianUploadLagSeconds',
          'firstCallAt',
          'lastCallAt',
          'reachedToday',
          'qualifiedToday',
          'repeatCalls',
          'deadSeconds',
          'deadGaps',
          'score',
        ],
      );
      final val = SupervisedUserDto(
        id: $checkedConvert('id', (v) => v as String),
        fullName: $checkedConvert('fullName', (v) => v as String),
        username: $checkedConvert('username', (v) => v as String),
        email: $checkedConvert('email', (v) => v as String),
        role: $checkedConvert(
          'role',
          (v) => $enumDecode(
            _$RoleEnumMap,
            v,
            unknownValue: Role.unknownDefaultOpenApi,
          ),
        ),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        presence: $checkedConvert(
          'presence',
          (v) => $enumDecode(
            _$PresenceStateEnumMap,
            v,
            unknownValue: PresenceState.unknownDefaultOpenApi,
          ),
        ),
        hasLiveSession: $checkedConvert('hasLiveSession', (v) => v as bool),
        sessionCount: $checkedConvert('sessionCount', (v) => v as num),
        lastSeenAt: $checkedConvert(
          'lastSeenAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        lastLoginAt: $checkedConvert(
          'lastLoginAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        lastSyncAt: $checkedConvert(
          'lastSyncAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        lastPullAt: $checkedConvert(
          'lastPullAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        pendingOps: $checkedConvert('pendingOps', (v) => v as num?),
        appVersion: $checkedConvert('appVersion', (v) => v as String?),
        journalAppelsAutorise: $checkedConvert(
          'journalAppelsAutorise',
          (v) => v as bool?,
        ),
        lastWriteAt: $checkedConvert(
          'lastWriteAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        activeSecondsToday: $checkedConvert(
          'activeSecondsToday',
          (v) => v as num,
        ),
        activeSecondsInShifts: $checkedConvert(
          'activeSecondsInShifts',
          (v) => v as num,
        ),
        firstSeenToday: $checkedConvert(
          'firstSeenToday',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        callsToday: $checkedConvert('callsToday', (v) => v as num),
        medianGapSeconds: $checkedConvert('medianGapSeconds', (v) => v as num?),
        medianUploadLagSeconds: $checkedConvert(
          'medianUploadLagSeconds',
          (v) => v as num?,
        ),
        firstCallAt: $checkedConvert(
          'firstCallAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        lastCallAt: $checkedConvert(
          'lastCallAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        reachedToday: $checkedConvert('reachedToday', (v) => v as num),
        qualifiedToday: $checkedConvert('qualifiedToday', (v) => v as num),
        repeatCalls: $checkedConvert('repeatCalls', (v) => v as num),
        deadSeconds: $checkedConvert('deadSeconds', (v) => v as num),
        deadGaps: $checkedConvert('deadGaps', (v) => v as num),
        score: $checkedConvert(
          'score',
          (v) => PerformanceScore.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SupervisedUserDtoToJson(SupervisedUserDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'fullName': instance.fullName,
      'username': instance.username,
      'email': instance.email,
      'role': _$RoleEnumMap[instance.role]!,
      'isActive': instance.isActive,
      'presence': _$PresenceStateEnumMap[instance.presence]!,
      'hasLiveSession': instance.hasLiveSession,
      'sessionCount': instance.sessionCount,
      'lastSeenAt': instance.lastSeenAt?.toIso8601String(),
      'lastLoginAt': instance.lastLoginAt?.toIso8601String(),
      'lastSyncAt': instance.lastSyncAt?.toIso8601String(),
      'lastPullAt': instance.lastPullAt?.toIso8601String(),
      'pendingOps': instance.pendingOps,
      'appVersion': instance.appVersion,
      'journalAppelsAutorise': instance.journalAppelsAutorise,
      'lastWriteAt': instance.lastWriteAt?.toIso8601String(),
      'activeSecondsToday': instance.activeSecondsToday,
      'activeSecondsInShifts': instance.activeSecondsInShifts,
      'firstSeenToday': instance.firstSeenToday?.toIso8601String(),
      'callsToday': instance.callsToday,
      'medianGapSeconds': instance.medianGapSeconds,
      'medianUploadLagSeconds': instance.medianUploadLagSeconds,
      'firstCallAt': instance.firstCallAt?.toIso8601String(),
      'lastCallAt': instance.lastCallAt?.toIso8601String(),
      'reachedToday': instance.reachedToday,
      'qualifiedToday': instance.qualifiedToday,
      'repeatCalls': instance.repeatCalls,
      'deadSeconds': instance.deadSeconds,
      'deadGaps': instance.deadGaps,
      'score': instance.score.toJson(),
    };

const _$RoleEnumMap = {
  Role.ADMIN: 'ADMIN',
  Role.COMMERCIAL: 'COMMERCIAL',
  Role.BANQUE_FINANCE: 'BANQUE_FINANCE',
  Role.SUPERVISEUR: 'SUPERVISEUR',
  Role.DIRECTION: 'DIRECTION',
  Role.ACCUEIL: 'ACCUEIL',
  Role.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$PresenceStateEnumMap = {
  PresenceState.ONLINE: 'ONLINE',
  PresenceState.RECENT: 'RECENT',
  PresenceState.AWAY: 'AWAY',
  PresenceState.unknownDefaultOpenApi: 'unknown_default_open_api',
};
