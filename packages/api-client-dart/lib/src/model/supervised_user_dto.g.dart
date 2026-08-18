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

  SupervisedUserDto departementName(String? departementName);

  SupervisedUserDto presence(PresenceState presence);

  SupervisedUserDto hasLiveSession(bool hasLiveSession);

  SupervisedUserDto sessionCount(num sessionCount);

  SupervisedUserDto lastSeenAt(DateTime? lastSeenAt);

  SupervisedUserDto lastLoginAt(DateTime? lastLoginAt);

  SupervisedUserDto lastSyncAt(DateTime? lastSyncAt);

  SupervisedUserDto lastWriteAt(DateTime? lastWriteAt);

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
    String? departementName,
    PresenceState presence,
    bool hasLiveSession,
    num sessionCount,
    DateTime? lastSeenAt,
    DateTime? lastLoginAt,
    DateTime? lastSyncAt,
    DateTime? lastWriteAt,
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
  SupervisedUserDto departementName(String? departementName) =>
      this(departementName: departementName);

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
  SupervisedUserDto lastWriteAt(DateTime? lastWriteAt) =>
      this(lastWriteAt: lastWriteAt);

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
    Object? departementName = const $CopyWithPlaceholder(),
    Object? presence = const $CopyWithPlaceholder(),
    Object? hasLiveSession = const $CopyWithPlaceholder(),
    Object? sessionCount = const $CopyWithPlaceholder(),
    Object? lastSeenAt = const $CopyWithPlaceholder(),
    Object? lastLoginAt = const $CopyWithPlaceholder(),
    Object? lastSyncAt = const $CopyWithPlaceholder(),
    Object? lastWriteAt = const $CopyWithPlaceholder(),
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
      departementName: departementName == const $CopyWithPlaceholder()
          ? _value.departementName
          // ignore: cast_nullable_to_non_nullable
          : departementName as String?,
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
      lastWriteAt: lastWriteAt == const $CopyWithPlaceholder()
          ? _value.lastWriteAt
          // ignore: cast_nullable_to_non_nullable
          : lastWriteAt as DateTime?,
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
          'departementName',
          'presence',
          'hasLiveSession',
          'sessionCount',
          'lastSeenAt',
          'lastLoginAt',
          'lastSyncAt',
          'lastWriteAt',
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
        departementName: $checkedConvert(
          'departementName',
          (v) => v as String?,
        ),
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
        lastWriteAt: $checkedConvert(
          'lastWriteAt',
          (v) => v == null ? null : DateTime.parse(v as String),
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
      'departementName': instance.departementName,
      'presence': _$PresenceStateEnumMap[instance.presence]!,
      'hasLiveSession': instance.hasLiveSession,
      'sessionCount': instance.sessionCount,
      'lastSeenAt': instance.lastSeenAt?.toIso8601String(),
      'lastLoginAt': instance.lastLoginAt?.toIso8601String(),
      'lastSyncAt': instance.lastSyncAt?.toIso8601String(),
      'lastWriteAt': instance.lastWriteAt?.toIso8601String(),
    };

const _$RoleEnumMap = {
  Role.ADMIN: 'ADMIN',
  Role.COMMERCIAL: 'COMMERCIAL',
  Role.BANQUE_FINANCE: 'BANQUE_FINANCE',
  Role.SUPERVISEUR: 'SUPERVISEUR',
  Role.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$PresenceStateEnumMap = {
  PresenceState.ONLINE: 'ONLINE',
  PresenceState.RECENT: 'RECENT',
  PresenceState.AWAY: 'AWAY',
  PresenceState.unknownDefaultOpenApi: 'unknown_default_open_api',
};
