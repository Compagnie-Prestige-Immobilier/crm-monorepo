// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_user_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AuthUserDtoCWProxy {
  AuthUserDto id(String id);

  AuthUserDto email(String email);

  AuthUserDto username(String username);

  AuthUserDto fullName(String fullName);

  AuthUserDto role(Role role);

  AuthUserDto isActive(bool isActive);

  AuthUserDto departementId(String? departementId);

  AuthUserDto phoneE164(String? phoneE164);

  AuthUserDto lastLoginAt(DateTime? lastLoginAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AuthUserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AuthUserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AuthUserDto call({
    String id,
    String email,
    String username,
    String fullName,
    Role role,
    bool isActive,
    String? departementId,
    String? phoneE164,
    DateTime? lastLoginAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAuthUserDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAuthUserDto.copyWith.fieldName(...)`
class _$AuthUserDtoCWProxyImpl implements _$AuthUserDtoCWProxy {
  const _$AuthUserDtoCWProxyImpl(this._value);

  final AuthUserDto _value;

  @override
  AuthUserDto id(String id) => this(id: id);

  @override
  AuthUserDto email(String email) => this(email: email);

  @override
  AuthUserDto username(String username) => this(username: username);

  @override
  AuthUserDto fullName(String fullName) => this(fullName: fullName);

  @override
  AuthUserDto role(Role role) => this(role: role);

  @override
  AuthUserDto isActive(bool isActive) => this(isActive: isActive);

  @override
  AuthUserDto departementId(String? departementId) =>
      this(departementId: departementId);

  @override
  AuthUserDto phoneE164(String? phoneE164) => this(phoneE164: phoneE164);

  @override
  AuthUserDto lastLoginAt(DateTime? lastLoginAt) =>
      this(lastLoginAt: lastLoginAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AuthUserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AuthUserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AuthUserDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? email = const $CopyWithPlaceholder(),
    Object? username = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? role = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? departementId = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? lastLoginAt = const $CopyWithPlaceholder(),
  }) {
    return AuthUserDto(
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
      departementId: departementId == const $CopyWithPlaceholder()
          ? _value.departementId
          // ignore: cast_nullable_to_non_nullable
          : departementId as String?,
      phoneE164: phoneE164 == const $CopyWithPlaceholder()
          ? _value.phoneE164
          // ignore: cast_nullable_to_non_nullable
          : phoneE164 as String?,
      lastLoginAt: lastLoginAt == const $CopyWithPlaceholder()
          ? _value.lastLoginAt
          // ignore: cast_nullable_to_non_nullable
          : lastLoginAt as DateTime?,
    );
  }
}

extension $AuthUserDtoCopyWith on AuthUserDto {
  /// Returns a callable class that can be used as follows: `instanceOfAuthUserDto.copyWith(...)` or like so:`instanceOfAuthUserDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AuthUserDtoCWProxy get copyWith => _$AuthUserDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AuthUserDto _$AuthUserDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AuthUserDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'email',
          'username',
          'fullName',
          'role',
          'isActive',
        ],
      );
      final val = AuthUserDto(
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
        departementId: $checkedConvert('departementId', (v) => v as String?),
        phoneE164: $checkedConvert('phoneE164', (v) => v as String?),
        lastLoginAt: $checkedConvert(
          'lastLoginAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$AuthUserDtoToJson(AuthUserDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'email': instance.email,
      'username': instance.username,
      'fullName': instance.fullName,
      'role': _$RoleEnumMap[instance.role]!,
      'isActive': instance.isActive,
      if (instance.departementId case final value?) 'departementId': value,
      if (instance.phoneE164 case final value?) 'phoneE164': value,
      if (instance.lastLoginAt?.toIso8601String() case final value?)
        'lastLoginAt': value,
    };

const _$RoleEnumMap = {
  Role.ADMIN: 'ADMIN',
  Role.COMMERCIAL: 'COMMERCIAL',
  Role.BANQUE_FINANCE: 'BANQUE_FINANCE',
  Role.SUPERVISEUR: 'SUPERVISEUR',
  Role.unknownDefaultOpenApi: 'unknown_default_open_api',
};
