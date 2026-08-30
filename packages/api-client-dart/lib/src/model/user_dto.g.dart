// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UserDtoCWProxy {
  UserDto id(String id);

  UserDto email(String email);

  UserDto username(String username);

  UserDto fullName(String fullName);

  UserDto role(Role role);

  UserDto isActive(bool isActive);

  UserDto phoneE164(String? phoneE164);

  UserDto lastLoginAt(DateTime? lastLoginAt);

  UserDto createdAt(DateTime createdAt);

  UserDto prospectCount(num prospectCount);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UserDto call({
    String id,
    String email,
    String username,
    String fullName,
    Role role,
    bool isActive,
    String? phoneE164,
    DateTime? lastLoginAt,
    DateTime createdAt,
    num prospectCount,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUserDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUserDto.copyWith.fieldName(...)`
class _$UserDtoCWProxyImpl implements _$UserDtoCWProxy {
  const _$UserDtoCWProxyImpl(this._value);

  final UserDto _value;

  @override
  UserDto id(String id) => this(id: id);

  @override
  UserDto email(String email) => this(email: email);

  @override
  UserDto username(String username) => this(username: username);

  @override
  UserDto fullName(String fullName) => this(fullName: fullName);

  @override
  UserDto role(Role role) => this(role: role);

  @override
  UserDto isActive(bool isActive) => this(isActive: isActive);

  @override
  UserDto phoneE164(String? phoneE164) => this(phoneE164: phoneE164);

  @override
  UserDto lastLoginAt(DateTime? lastLoginAt) => this(lastLoginAt: lastLoginAt);

  @override
  UserDto createdAt(DateTime createdAt) => this(createdAt: createdAt);

  @override
  UserDto prospectCount(num prospectCount) =>
      this(prospectCount: prospectCount);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UserDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? email = const $CopyWithPlaceholder(),
    Object? username = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? role = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? lastLoginAt = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? prospectCount = const $CopyWithPlaceholder(),
  }) {
    return UserDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      email: email == const $CopyWithPlaceholder()
          ? _value.email
          // ignore: cast_nullable_to_non_nullable
          : email as String,
      username: username == const $CopyWithPlaceholder()
          ? _value.username
          // ignore: cast_nullable_to_non_nullable
          : username as String,
      fullName: fullName == const $CopyWithPlaceholder()
          ? _value.fullName
          // ignore: cast_nullable_to_non_nullable
          : fullName as String,
      role: role == const $CopyWithPlaceholder()
          ? _value.role
          // ignore: cast_nullable_to_non_nullable
          : role as Role,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
      phoneE164: phoneE164 == const $CopyWithPlaceholder()
          ? _value.phoneE164
          // ignore: cast_nullable_to_non_nullable
          : phoneE164 as String?,
      lastLoginAt: lastLoginAt == const $CopyWithPlaceholder()
          ? _value.lastLoginAt
          // ignore: cast_nullable_to_non_nullable
          : lastLoginAt as DateTime?,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
      prospectCount: prospectCount == const $CopyWithPlaceholder()
          ? _value.prospectCount
          // ignore: cast_nullable_to_non_nullable
          : prospectCount as num,
    );
  }
}

extension $UserDtoCopyWith on UserDto {
  /// Returns a callable class that can be used as follows: `instanceOfUserDto.copyWith(...)` or like so:`instanceOfUserDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UserDtoCWProxy get copyWith => _$UserDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UserDto _$UserDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UserDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'email',
          'username',
          'fullName',
          'role',
          'isActive',
          'phoneE164',
          'lastLoginAt',
          'createdAt',
          'prospectCount',
        ],
      );
      final val = UserDto(
        id: $checkedConvert('id', (v) => v as String),
        email: $checkedConvert('email', (v) => v as String),
        username: $checkedConvert('username', (v) => v as String),
        fullName: $checkedConvert('fullName', (v) => v as String),
        role: $checkedConvert(
          'role',
          (v) => $enumDecode(
            _$RoleEnumMap,
            v,
            unknownValue: Role.unknownDefaultOpenApi,
          ),
        ),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        phoneE164: $checkedConvert('phoneE164', (v) => v as String?),
        lastLoginAt: $checkedConvert(
          'lastLoginAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        createdAt: $checkedConvert(
          'createdAt',
          (v) => DateTime.parse(v as String),
        ),
        prospectCount: $checkedConvert('prospectCount', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$UserDtoToJson(UserDto instance) => <String, dynamic>{
  'id': instance.id,
  'email': instance.email,
  'username': instance.username,
  'fullName': instance.fullName,
  'role': _$RoleEnumMap[instance.role]!,
  'isActive': instance.isActive,
  'phoneE164': instance.phoneE164,
  'lastLoginAt': instance.lastLoginAt?.toIso8601String(),
  'createdAt': instance.createdAt.toIso8601String(),
  'prospectCount': instance.prospectCount,
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
